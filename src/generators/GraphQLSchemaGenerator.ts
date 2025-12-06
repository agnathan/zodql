/**
 * =================================================================================
 * GraphQLSchemaGenerator.ts
 * =================================================================================
 *
 * This class is responsible for generating a complete GraphQL Schema Definition Language (SDL)
 * string from a configuration object that uses Zod schemas to define types, queries, mutations,
 * subscriptions, and authentication rules.
 *
 * It is specifically designed to work within an AWS AppSync-like environment, supporting:
 * - Automatic generation of object types, input types, enums, and unions
 * - AWS-specific scalar types (AWSDateTime, AWSJSON, etc.)
 * - AWS AppSync authentication and authorization directives (@aws_iam, @aws_cognito_user_pools, etc.)
 * - Registry-based type naming for shared Zod schemas
 * - Proper handling of defaults, optionals, nullables, arrays, and unions
 * - Prevention of duplicate type definitions
 * - Key input generation for primary and composite keys
 *
 * The generator performs a two-phase process:
 *   1. Dependency Discovery – traverses all Zod schemas to collect referenced types
 *   2. SDL Generation – emits clean, ordered, and valid GraphQL SDL
 *
 * @author Your Name / Team
 * @file GraphQLSchemaGenerator.ts
 * @version 1.0.0
 * @license MIT
 * =================================================================================
 */

import { z } from 'zod';
import { Registry } from '../zodql/registry.js';
import { Scalars } from '../zodql/scalars.js';
import { PatternManager, PatternManagerOptions } from '../patterns/PatternManager.js';
import { RelationshipRegistry } from '../zodql/relationships.js';
import { ExtensionManager, type SchemaExtension, type ExtensionManagerOptions } from '../extensions/index.js';
import { GenerationPhase } from '../extensions/types.js';

// =================================================================================
// Type Definitions & Interfaces
// =================================================================================

/**
 * Represents an authentication/authorization rule applied at the schema level.
 * Supports multiple AWS AppSync auth strategies.
 */
interface AuthRule {
  /** Type of authentication mechanism */
  type:
    | 'iam'
    | 'aws_iam'
    | '@aws_iam'
    | 'cognito_user_pools'
    | '@aws_cognito_user_pools'
    | 'api_key'
    | 'aws_api_key'
    | '@aws_api_key'
    | 'aws_auth'
    | '@aws_auth';
  /** Optional list of Cognito groups allowed to access protected fields */
  cognitoGroups?: string[];
}

/**
 * Configuration object passed to the GraphQLSchemaGenerator.
 * Defines the full structure of the entity and its GraphQL API surface.
 */
export interface GeneratorConfig {
  /** Core entity schema (typically a ZodObject) */
  schema: z.ZodTypeAny;

  /** Custom input types used in operations */
  inputs?: Record<string, z.ZodTypeAny>;

  /** Query resolvers with Zod-validated arguments and return types */
  queries?: Record<string, z.ZodFunction<any, any>>;

  /** Mutation resolvers */
  mutations?: Record<string, z.ZodFunction<any, any>>;

  /** Subscription resolvers */
  subscriptions?: Record<string, z.ZodFunction<any, any>>;

  /** Connection/pagination-related types (e.g., Edge, PageInfo) */
  connections?: Record<string, z.ZodTypeAny>;

  /** Global authentication rules applied to root operation fields */
  auth?: AuthRule[];

  /** Primary and composite key schemas for DynamoDB-style queries */
  keys?: {
    primary?: z.ZodTypeAny;
    composite?: z.ZodTypeAny;
  };
}

/**
 * Options for GraphQLSchemaGenerator
 */
export interface GeneratorOptions {
  /** Pattern manager options for relationship patterns (deprecated: use extensions instead) */
  patternManager?: PatternManagerOptions;
  
  /** Whether to apply relationship patterns before generation (deprecated: use extensions instead) */
  applyPatterns?: boolean;
  
  /** Schema extensions to use during generation */
  extensions?: SchemaExtension[] | ExtensionManagerOptions;
}

// =================================================================================
// Constants
// =================================================================================

/** Set of all recognized AWS-specific scalar types */
const AWS_SCALARS = new Set([
  'AWSDateTime',
  'AWSTime',
  'AWSDate',
  'AWSEmail',
  'AWSJSON',
  'AWSJSONObject',
  'AWSURL',
  'AWSPhone',
  'AWSIPAddress',
]);

/** Mapping from common Zod/custom names to official AWS AppSync scalar names */
const AWS_SCALAR_MAPPING: Record<string, string> = {
  DateTime: 'AWSDateTime',
  JSON: 'AWSJSON',
  AWSTime: 'AWSTime',
  AWSDate: 'AWSDate',
  AWSEmail: 'AWSEmail',
  AWSJSONObject: 'AWSJSONObject',
  AWSURL: 'AWSURL',
  AWSPhone: 'AWSPhone',
  AWSIPAddress: 'AWSIPAddress',
};

// =================================================================================
// Main Class: GraphQLSchemaGenerator
// =================================================================================

export class GraphQLSchemaGenerator {
  /** Tracks type names that need to be emitted to avoid duplicates */
  private generatedTypes = new Set<string>();

  /** Tracks which AWS scalars have been referenced */
  private usedAWSScalars = new Set<string>();

  /** Tracks which AWS auth directives are required in the schema */
  private usedAWSDirectives = new Set<string>();

  /** Auth directives applied to all root operation fields (Query/Mutation/Subscription) */
  private activeAuthDirectives: string[] = [];

  /** Pattern manager for relationship patterns (deprecated: use extensionManager) */
  private patternManager?: PatternManager;

  /** Extension manager for schema extensions */
  private extensionManager?: ExtensionManager;

  /** Effective config after extension/pattern application */
  private effectiveConfig: GeneratorConfig;

  /**
   * Constructs a new GraphQL schema generator instance.
   *
   * @param name   The name of the primary entity type (e.g., "Post", "User")
   * @param config Configuration object defining the full API surface
   * @param options Optional generator options including extensions
   */
  constructor(
    public readonly name: string,
    config: GeneratorConfig,
    options: GeneratorOptions = {}
  ) {
    this.effectiveConfig = config;

    // Initialize extension manager if extensions are provided
    if (options.extensions) {
      if (Array.isArray(options.extensions)) {
        this.extensionManager = new ExtensionManager({ extensions: options.extensions });
      } else {
        this.extensionManager = new ExtensionManager(options.extensions);
      }
    }

    // Backward compatibility: Initialize pattern manager if patterns should be applied
    // This will be deprecated in favor of extensions
    if (options.applyPatterns !== false && options.patternManager && !this.extensionManager) {
      this.patternManager = new PatternManager(options.patternManager);
      
      // Apply patterns to transform the config
      const { modifiedConfig } = this.patternManager.applyPatterns(
        config,
        name,
        true // continueOnError
      );
      this.effectiveConfig = modifiedConfig;
    }
  }

  /**
   * Get the effective configuration (after pattern application)
   */
  get config(): GeneratorConfig {
    return this.effectiveConfig;
  }

  // =============================================================================
  // Public API
  // =============================================================================

  /**
   * Generates and returns the complete GraphQL SDL string for the configured entity.
   *
   * The generation follows a deterministic order to ensure readable and valid output:
   * 1. Extension initialization
   * 2. Extension beforeDiscovery hook
   * 3. Dependency discovery
   * 4. Extension afterDiscovery hook
   * 5. Extension beforeGeneration hook
   * 6. AWS scalar & directive definitions
   * 7. Dependency types (enums, inputs, unions, objects)
   * 8. Main entity type
   * 9. Root operation types (Query, Mutation, Subscription)
   * 10. Connection types
   * 11. Key input types
   * 12. Extension afterGeneration hook
   *
   * @returns Fully formed GraphQL SDL string
   */
  public async generateSchemaFile(): Promise<string>;
  public generateSchemaFile(): string;
  public generateSchemaFile(): string | Promise<string> {
    return this.generateSchemaFileAsync();
  }

  /**
   * Async version of generateSchemaFile that properly handles extensions
   */
  private async generateSchemaFileAsync(): Promise<string> {
    let config = this.effectiveConfig;
    const { schema, inputs, queries, mutations, subscriptions, connections, keys, auth } = config;
    const definitions: string[] = [];

    // Create extension context
    const extensionContext = {
      config,
      entityName: this.name,
      registry: Registry,
      shared: new Map<string, any>(),
      phase: GenerationPhase.INITIALIZATION,
    };

    // 1. Initialize extensions
    if (this.extensionManager) {
      await this.extensionManager.initialize(extensionContext);
    }

    // 2. Run beforeDiscovery hook (extensions can modify config before discovery)
    if (this.extensionManager) {
      extensionContext.phase = GenerationPhase.BEFORE_DISCOVERY;
      config = await this.extensionManager.beforeDiscovery(extensionContext);
      extensionContext.config = config;
    }

    // 3. Process global auth rules and collect required directives
    this.processAuthConfiguration(auth);

    // 4. Discover all referenced types (populates generatedTypes)
    this.discoverDependencies(config.schema);
    this.discoverRecordDependencies(config.inputs);
    this.discoverRecordDependencies(config.queries);
    this.discoverRecordDependencies(config.mutations);
    this.discoverRecordDependencies(config.subscriptions);
    this.discoverRecordDependencies(config.connections);

    if (config.keys?.primary) this.discoverDependencies(config.keys.primary);
    if (config.keys?.composite) this.discoverDependencies(config.keys.composite);

    // Discover relationship target types (types referenced in relationships)
    this.discoverRelationshipTypes();
    
    // Discover additional types registered by patterns/extensions (Connection, Edge, PageInfo, etc.)
    this.discoverPatternAdditionalTypes();

    // 5. Run afterDiscovery hook (extensions can transform discovered types)
    if (this.extensionManager) {
      extensionContext.phase = GenerationPhase.AFTER_DISCOVERY;
      config = await this.extensionManager.afterDiscovery(extensionContext);
      extensionContext.config = config;
    }

    // 6. Run beforeGeneration hook (final transformations)
    if (this.extensionManager) {
      extensionContext.phase = GenerationPhase.BEFORE_GENERATION;
      config = await this.extensionManager.beforeGeneration(extensionContext);
      extensionContext.config = config;
    }

    // 7. Generate the main entity object type
    if (config.schema instanceof z.ZodObject) {
      definitions.push(this.generateObjectType(this.name, config.schema));
    }

    // 8. Generate root operation types (Query, Mutation, Subscription)
    // Query is required by GraphQL spec, so always generate it (with dummy field if empty)
    // Mutation and Subscription are optional, so only generate if they have fields
    const hasQueries = config.queries && Object.keys(config.queries).length > 0;
    if (hasQueries) {
      const queryDef = this.generateRootOperation('Query', config.queries!);
      if (queryDef) {
        definitions.push(queryDef);
      } else {
        // If generateRootOperation returned empty string (no valid fields), add dummy Query
        definitions.push('type Query {\n  empty: String\n}');
      }
    } else {
      // GraphQL requires a Query type, so add a minimal one if none exists
      definitions.push('type Query {\n  empty: String\n}');
    }
    if (config.mutations) {
      const mutationDef = this.generateRootOperation('Mutation', config.mutations);
      if (mutationDef) definitions.push(mutationDef);
    }
    if (config.subscriptions) {
      const subscriptionDef = this.generateRootOperation('Subscription', config.subscriptions);
      if (subscriptionDef) definitions.push(subscriptionDef);
    }

    // 9. Generate connection-related types (e.g., PostConnection)
    // Connection types are always generated from connections config, even if already discovered
    if (config.connections) {
      for (const [key, connectionSchema] of Object.entries(config.connections)) {
        if (connectionSchema instanceof z.ZodObject) {
          // Try to get the registered name first, fallback to key if not registered
          const connectionName = Registry.get(connectionSchema) || key;
          // Mark as generated to prevent duplicate generation in step 8
          this.generatedTypes.add(connectionName);
          definitions.push(this.generateObjectType(connectionName, connectionSchema));
        }
      }
    }

    // 10. Generate primary/composite key input types
    if (config.keys) {
      this.generateKeyType(config.keys.primary, 'PrimaryKeyInput', definitions);
      this.generateKeyType(config.keys.composite, 'CompositeKeyInput', definitions);
    }

    // 11. Emit required AWS scalar and directive definitions
    const awsDefs = this.generateAWSDefinitions();

    // 12. Emit all discovered dependency types (enums, inputs, unions, etc.)
    const dependencyDefs = Array.from(this.generatedTypes)
      .map((typeName) => this.generateTypeDefinition(typeName))
      .filter((def): def is string => !!def);

    // 13. Assemble final SDL (AWS defs first, then dependencies, then main definitions)
    let schemaSDL = [
      awsDefs,
      ...dependencyDefs,
      ...definitions,
    ]
      .filter(Boolean)
      .join('\n\n');

    // 14. Run afterGeneration hook (extensions can modify final SDL)
    if (this.extensionManager) {
      extensionContext.phase = GenerationPhase.AFTER_GENERATION;
      schemaSDL = await this.extensionManager.afterGeneration(extensionContext, schemaSDL);
    }

    return schemaSDL;
  }

  // =============================================================================
  // Dependency Discovery Phase
  // =============================================================================

  /**
   * Recursively discovers dependencies from a record (object) of Zod types.
   * Used for inputs, queries, mutations, etc.
   *
   * @param record Optional record of Zod types to scan
   */
  private discoverRecordDependencies(record?: Record<string, any>): void {
    if (!record) return;
    for (const item of Object.values(record)) {
      this.discoverDependencies(item);
    }
  }

  /**
   * Discover types referenced in relationships
   */
  private discoverRelationshipTypes(): void {
    const relationships = RelationshipRegistry.getAll();
    for (const relationship of relationships) {
      // Discover target type (e.g., Dashboard)
      if (Registry.has(relationship.targetType)) {
        const targetTypeName = Registry.get(relationship.targetType);
        if (targetTypeName && targetTypeName !== this.name) {
          this.generatedTypes.add(targetTypeName);
          // Get the registered (possibly modified) version of the target type
          // Find the last registered schema with this name (modified version from patterns)
          let registeredSchema: z.ZodTypeAny | undefined;
          for (const [schema, name] of Registry.entries()) {
            if (name === targetTypeName) {
              registeredSchema = schema; // Keep overwriting to get the last one
            }
          }
          if (registeredSchema) {
            // Discover dependencies of the registered (possibly modified) target type
            this.discoverDependencies(registeredSchema);
          }
        }
      }
    }
  }

  /**
   * Discover additional types registered by patterns (Edge, PageInfo)
   * Note: Connection types are handled separately via the connections config
   */
  private discoverPatternAdditionalTypes(): void {
    // Look for types that patterns typically create (excluding Connection types)
    const patternTypeSuffixes = ['Edge', 'PageInfo'];
    
    for (const [schema, name] of Registry.entries()) {
      // Check if this is a pattern-generated type (but not a Connection type)
      if (patternTypeSuffixes.some(suffix => name.endsWith(suffix))) {
        if (!this.generatedTypes.has(name)) {
          this.generatedTypes.add(name);
          // Also discover dependencies of these types
          this.discoverDependencies(schema);
        }
      }
    }
  }

  /**
   * Recursively traverses a Zod type to find all registered types that need to be
   * generated. Handles wrappers (optional/default/nullable/array), functions,
   * unions, and nested objects.
   *
   * @param zodType The Zod type to analyze
   */
  private discoverDependencies(zodType: z.ZodTypeAny): void {
    if (!zodType) return;

    // Unwrap common effect wrappers
    if (zodType instanceof z.ZodDefault || zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable) {
      this.discoverDependencies(zodType._def.innerType);
      return;
    }

    if (zodType instanceof z.ZodArray) {
      this.discoverDependencies(zodType._def.type);
      return;
    }

    // Handle function arguments and return types
    if (zodType instanceof z.ZodFunction) {
      // Arguments are typically a tuple; we only care about the first object argument
      if (zodType._def.args instanceof z.ZodTuple) {
        zodType._def.args.items.forEach((arg: unknown) => {
          if (arg instanceof z.ZodObject) {
            Object.values(arg.shape).forEach((field) => this.discoverDependencies(field as z.ZodTypeAny));
          }
        });
      }
      this.discoverDependencies(zodType._def.returns);
      return;
    }

    // Handle union types
    if (zodType instanceof z.ZodUnion) {
      zodType._def.options.forEach((opt: z.ZodTypeAny) => this.discoverDependencies(opt));
      return;
    }

    // Deep scan object shapes
    if (zodType instanceof z.ZodObject) {
      Object.values(zodType.shape).forEach((field: any) => this.discoverDependencies(field));
    }

    // Register named types from the global Registry (skip main entity and built-ins)
    if (Registry.has(zodType)) {
      const typeName = Registry.get(zodType)!;

      if (typeName === this.name || typeName === 'DateTime' || typeName === 'JSON') return;

      this.generatedTypes.add(typeName);
    }
  }

  // =============================================================================
  // Type Generation Phase
  // =============================================================================

  /**
   * Generates a GraphQL type definition (enum, input, object, union) for a registered name.
   *
   * @param typeName Name of the type as registered in the Registry
   * @returns SDL string or null if the type cannot be generated
   */
  private generateTypeDefinition(typeName: string): string | null {
    // Find the schema registered with this name
    // If multiple schemas have the same name (e.g., original and modified),
    // get the last one registered (which is likely the modified version from patterns)
    // Map.entries() returns in insertion order, so last match is most recent
    let schema: z.ZodTypeAny | undefined;
    
    for (const [regSchema, regName] of Registry.entries()) {
      if (regName === typeName) {
        schema = regSchema; // Keep overwriting to get the last one
      }
    }
    
    if (!schema) return null;

    // Enums
    if (schema instanceof z.ZodEnum) {
      return `enum ${typeName} {\n${schema._def.values.map((v: string) => `  ${v}`).join('\n')}\n}`;
    }

    // Objects → input vs regular type based on naming convention
    if (schema instanceof z.ZodObject) {
      return typeName.endsWith('Input')
        ? this.generateInputType(typeName, schema)
        : this.generateObjectType(typeName, schema);
    }

    // Unions
    if (schema instanceof z.ZodUnion) {
      return this.generateUnionType(typeName, schema);
    }

    return null;
  }

  /**
   * Generates a root operation type (Query, Mutation, or Subscription) with fields
   * and optional auth directives.
   *
   * @param type       The root type name
   * @param operations Map of operation name → ZodFunction schema
   * @returns SDL string for the root type
   */
  private generateRootOperation(
    type: 'Query' | 'Mutation' | 'Subscription',
    operations: Record<string, z.ZodFunction<any, any>>
  ): string {
    const lines = [`type ${type} {`];
    const authString = this.activeAuthDirectives.length ? ` ${this.activeAuthDirectives.join(' ')}` : '';
    let hasFields = false;

    for (const [opName, opSchema] of Object.entries(operations)) {
      if (opSchema instanceof z.ZodFunction) {
        const args = this.extractFunctionArgs(opSchema);
        const returnType = this.zodTypeToGraphQL(opSchema._def.returns, false);
        const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';
        lines.push(`  ${opName}${argsStr}: ${returnType}${authString}`);
        hasFields = true;
      }
    }
    
    // GraphQL doesn't allow empty types, so return empty string if no fields
    if (!hasFields) {
      return '';
    }
    
    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generates a regular GraphQL object type.
   */
  private generateObjectType(name: string, schema: z.ZodObject<any>): string {
    return this.generateFieldCollection('type', name, schema);
  }

  /**
   * Generates a GraphQL input object type.
   */
  private generateInputType(name: string, schema: z.ZodObject<any>): string {
    return this.generateFieldCollection('input', name, schema, true);
  }

  /**
   * Shared logic for generating both object and input types.
   *
   * @param kind         'type' or 'input'
   * @param name         Type name
   * @param schema       ZodObject schema
   * @param allowDefaults Whether default values are permitted (true for inputs/args)
   */
  private generateFieldCollection(
    kind: 'type' | 'input',
    name: string,
    schema: z.ZodObject<any>,
    allowDefaults = false
  ): string {
    const lines = [`${kind} ${name} {`];
    for (const [fieldName, fieldSchema] of Object.entries(schema.shape)) {
      // Handle ZodFunction fields (for connection fields with arguments)
      if (fieldSchema instanceof z.ZodFunction) {
        const args = this.extractFunctionArgs(fieldSchema);
        const returnType = this.zodTypeToGraphQL(fieldSchema._def.returns, false);
                const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';
        lines.push(`  ${fieldName}${argsStr}: ${returnType}`);
      } else {
        const typeStr = this.zodTypeToGraphQL(fieldSchema as z.ZodTypeAny, allowDefaults);
        lines.push(`  ${fieldName}: ${typeStr}`);
      }
    }
    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generates an input type for primary or composite keys if a schema is provided.
   *
   * @param schema       Zod schema for the key (usually ZodObject)
   * @param defaultName  Fallback name if not registered
   * @param definitions  Array to push the generated definition into
   */
  private generateKeyType(schema: z.ZodTypeAny | undefined, defaultName: string, definitions: string[]): void {
    if (schema instanceof z.ZodObject) {
      const keyName = Registry.get(schema) || defaultName;
      if (this.markAsGenerated(keyName)) {
        definitions.push(this.generateInputType(keyName, schema));
      }
    }
  }

  /**
   * Generates a GraphQL union type from a ZodUnion.
   */
  private generateUnionType(typeName: string, schema: z.ZodUnion<any>): string {
    const types = schema._def.options
      .map((opt: z.ZodTypeAny) => Registry.get(opt))
      .filter((t: string | undefined): t is string => !!t && t !== 'Unknown');

    return types.length ? `union ${typeName} = ${types.join(' | ')}` : '';
  }

  /**
   * Extracts argument definitions from a ZodFunction (assumes first tuple item is the args object).
   *
   * @param funcSchema ZodFunction representing a resolver
   * @returns Array of "name: Type" argument strings
   */
  private extractFunctionArgs(funcSchema: z.ZodFunction<any, any>): string[] {
    const argsDef = funcSchema._def.args;
    if (argsDef instanceof z.ZodTuple && argsDef._def.items.length > 0) {
      const firstArg = argsDef._def.items[0];
      if (firstArg instanceof z.ZodObject) {
        return Object.entries(firstArg.shape).map(([name, schema]) => {
          return `${name}: ${this.zodTypeToGraphQL(schema as z.ZodTypeAny, true)}`;
        });
      }
    }
    return [];
  }

  // =============================================================================
  // Zod → GraphQL Type Mapping
  // =============================================================================

  /**
   * Converts a Zod type into its GraphQL representation.
   * Handles wrappers, arrays, defaults, unions, registered types, and AWS scalars.
   *
   * @param zodType        The Zod type to convert
   * @param includeDefault Whether to emit default value syntax (only valid for input/arg fields)
   * @returns GraphQL type string (e.g., "String!", "[Int!]!", "MyEnum!")
   */
  private zodTypeToGraphQL(zodType: z.ZodTypeAny, includeDefault: boolean = true): string {
    // --- Wrappers ---
    if (zodType instanceof z.ZodDefault) {
      const inner = this.zodTypeToGraphQL(zodType._def.innerType, false);
      const baseType = inner.endsWith('!') ? inner.slice(0, -1) : inner;
      const defaultVal = zodType._def.defaultValue();

      return includeDefault && defaultVal !== undefined
        ? `${baseType}! = ${this.formatDefaultValue(defaultVal)}`
        : `${baseType}!`;
    }

    if (zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable) {
      return this.zodTypeToGraphQL(zodType._def.innerType, false).replace(/!+$/, '');
    }

    // --- Collections ---
    if (zodType instanceof z.ZodArray) {
      const inner = this.zodTypeToGraphQL(zodType._def.type, false);
      return `[${inner}]!`;
    }

    // --- Unions ---
    if (zodType instanceof z.ZodUnion) {
      const unionName = Registry.get(zodType);
      if (unionName) {
        this.generatedTypes.add(unionName);
        return `${unionName}!`;
      }
      return 'String!'; // Safe fallback
    }

    // --- Functions (for connection fields with arguments) ---
    if (zodType instanceof z.ZodFunction) {
      return this.zodTypeToGraphQL(zodType._def.returns, false);
    }

    // --- Base Scalars & Registered Types ---
    let typeName = 'String';

    if (Registry.has(zodType)) {
      const regName = Registry.get(zodType)!;
      typeName = AWS_SCALAR_MAPPING[regName] || regName;
      if (AWS_SCALAR_MAPPING[regName]) this.usedAWSScalars.add(typeName);
    } else if (zodType === Scalars.ID) {
      typeName = 'ID';
    } else if (zodType === Scalars.String) {
      typeName = 'String';
    } else if (zodType === Scalars.Int) {
      typeName = 'Int';
    } else if (zodType === Scalars.Float) {
      typeName = 'Float';
    } else if (zodType === Scalars.Boolean) {
      typeName = 'Boolean';
    } else if (zodType === Scalars.DateTime) {
      typeName = 'AWSDateTime';
      this.usedAWSScalars.add(typeName);
    } else if (zodType === Scalars.JSON) {
      typeName = 'AWSJSON';
      this.usedAWSScalars.add(typeName);
    }

    return `${typeName}!`;
  }

  /**
   * Formats a JavaScript value into a valid GraphQL default value literal.
   *
   * @param value Any JavaScript value
   * @returns String representation suitable for SDL
   */
  private formatDefaultValue(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`;
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.formatDefaultValue(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value)
        .map(([k, v]) => `${k}: ${this.formatDefaultValue(v)}`)
        .join(', ');
      return `{ ${entries} }`;
    }
    return String(value);
  }

  // =============================================================================
  // AWS Auth & Directive Handling
  // =============================================================================

  /**
   * Processes the auth configuration and builds the list of active directives
   * to be applied to root operation fields.
   *
   * @param authRules Optional array of authentication rules
   */
  private processAuthConfiguration(authRules?: AuthRule[]): void {
    if (!authRules) return;

    for (const rule of authRules) {
      switch (rule.type) {
        case 'iam':
        case 'aws_iam':
        case '@aws_iam':
          this.registerDirective('@aws_iam');
          break;

        case 'cognito_user_pools':
        case '@aws_cognito_user_pools':
          this.usedAWSDirectives.add('@aws_cognito_user_pools');
          if (rule.cognitoGroups?.length) {
            const groups = rule.cognitoGroups.map((g) => `"${g}"`).join(', ');
            this.activeAuthDirectives.push(`@aws_cognito_user_pools(cognito_groups: [${groups}])`);
          } else {
            this.activeAuthDirectives.push('@aws_cognito_user_pools');
          }
          break;

        case 'api_key':
        case 'aws_api_key':
        case '@aws_api_key':
          this.registerDirective('@aws_api_key');
          break;

        case 'aws_auth':
        case '@aws_auth':
          this.registerDirective('@aws_auth');
          break;
      }
    }
  }

  /**
   * Registers an AWS directive as both required and active (for root fields).
   *
   * @param directive Directive name (with @ prefix)
   */
  private registerDirective(directive: string): void {
    this.usedAWSDirectives.add(directive);
    if (!this.activeAuthDirectives.includes(directive)) {
      this.activeAuthDirectives.push(directive);
    }
  }

  /**
   * Generates scalar and directive definitions for AWS-specific features that were used.
   *
   * @returns SDL string or null if nothing to emit
   */
  private generateAWSDefinitions(): string | null {
    const definitions: string[] = [];

    // Emit used AWS scalars
    AWS_SCALARS.forEach((scalar) => {
      if (this.usedAWSScalars.has(scalar)) {
        definitions.push(`scalar ${scalar}`);
      }
    });

    // Emit required AWS directives
    if (this.usedAWSDirectives.has('@aws_auth')) {
      definitions.push('directive @aws_auth(...) on FIELD_DEFINITION');
    }
    if (this.usedAWSDirectives.has('@aws_iam')) {
      definitions.push('directive @aws_iam on FIELD_DEFINITION');
    }
    if (this.usedAWSDirectives.has('@aws_cognito_user_pools')) {
      definitions.push('directive @aws_cognito_user_pools(cognito_groups: [String!]) on FIELD_DEFINITION');
    }
    if (this.usedAWSDirectives.has('@aws_api_key')) {
      definitions.push('directive @aws_api_key on FIELD_DEFINITION');
    }

    return definitions.length ? definitions.join('\n') : null;
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Marks a type as generated and returns whether it was newly added.
   * Used to prevent duplicate type emissions.
   *
   * @param typeName Name of the type
   * @returns true if the type was newly marked, false if already present
   */
  private markAsGenerated(typeName: string): boolean {
    if (this.generatedTypes.has(typeName)) return false;
    this.generatedTypes.add(typeName);
    return true;
  }
}