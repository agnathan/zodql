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
interface GeneratorConfig {
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

  /**
   * Constructs a new GraphQL schema generator instance.
   *
   * @param name   The name of the primary entity type (e.g., "Post", "User")
   * @param config Configuration object defining the full API surface
   */
  constructor(
    public readonly name: string,
    public readonly config: GeneratorConfig
  ) {}

  // =============================================================================
  // Public API
  // =============================================================================

  /**
   * Generates and returns the complete GraphQL SDL string for the configured entity.
   *
   * The generation follows a deterministic order to ensure readable and valid output:
   * 1. AWS scalar & directive definitions
   * 2. Dependency types (enums, inputs, unions, objects)
   * 3. Main entity type
   * 4. Root operation types (Query, Mutation, Subscription)
   * 5. Connection types
   * 6. Key input types
   *
   * @returns Fully formed GraphQL SDL string
   */
  public generateSchemaFile(): string {
    const { schema, inputs, queries, mutations, subscriptions, connections, keys, auth } = this.config;
    const definitions: string[] = [];

    // 1. Process global auth rules and collect required directives
    this.processAuthConfiguration(auth);

    // 2. Discover all referenced types (populates generatedTypes)
    this.discoverDependencies(schema);
    this.discoverRecordDependencies(inputs);
    this.discoverRecordDependencies(queries);
    this.discoverRecordDependencies(mutations);
    this.discoverRecordDependencies(subscriptions);
    this.discoverRecordDependencies(connections);

    if (keys?.primary) this.discoverDependencies(keys.primary);
    if (keys?.composite) this.discoverDependencies(keys.composite);

    // 3. Generate the main entity object type
    if (schema instanceof z.ZodObject) {
      definitions.push(this.generateObjectType(this.name, schema));
    }

    // 4. Generate root operation types (Query, Mutation, Subscription)
    if (queries) definitions.push(this.generateRootOperation('Query', queries));
    if (mutations) definitions.push(this.generateRootOperation('Mutation', mutations));
    if (subscriptions) definitions.push(this.generateRootOperation('Subscription', subscriptions));

    // 5. Generate connection-related types (e.g., PostConnection)
    if (connections) {
      for (const [key, connectionSchema] of Object.entries(connections)) {
        if (connectionSchema instanceof z.ZodObject) {
          const connectionName = Registry.get(connectionSchema) || `${this.name}Connection`;
          if (this.markAsGenerated(connectionName)) {
            definitions.push(this.generateObjectType(connectionName, connectionSchema));
          }
        }
      }
    }

    // 6. Generate primary/composite key input types
    if (keys) {
      this.generateKeyType(keys.primary, 'PrimaryKeyInput', definitions);
      this.generateKeyType(keys.composite, 'CompositeKeyInput', definitions);
    }

    // 7. Emit required AWS scalar and directive definitions
    const awsDefs = this.generateAWSDefinitions();

    // 8. Emit all discovered dependency types (enums, inputs, unions, etc.)
    const dependencyDefs = Array.from(this.generatedTypes)
      .map((typeName) => this.generateTypeDefinition(typeName))
      .filter((def): def is string => !!def);

    // 9. Assemble final SDL (AWS defs first, then dependencies, then main definitions)
    return [
      awsDefs,
      ...dependencyDefs,
      ...definitions,
    ]
      .filter(Boolean)
      .join('\n\n');
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
        zodType._def.args.items.forEach((arg: z.ZodTypeAny) => {
          if (arg instanceof z.ZodObject) {
            Object.values(arg.shape).forEach((field) => this.discoverDependencies(field));
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
    let schema: z.ZodTypeAny | undefined;
    for (const [regSchema, regName] of Registry.entries()) {
      if (regName === typeName) {
        schema = regSchema;
        break;
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

    for (const [opName, opSchema] of Object.entries(operations)) {
      if (opSchema instanceof z.ZodFunction) {
        const args = this.extractFunctionArgs(opSchema);
        const returnType = this.zodTypeToGraphQL(opSchema._def.returns, false);
        const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';
        lines.push(`  ${opName}${argsStr}: ${returnType}${authString}`);
      }
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
      const typeStr = this.zodTypeToGraphQL(fieldSchema as z.ZodTypeAny, allowDefaults);
      lines.push(`  ${fieldName}: ${typeStr}`);
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