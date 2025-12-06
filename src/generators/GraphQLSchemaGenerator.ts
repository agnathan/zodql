import { z } from 'zod';
import { Registry } from '../zodql/registry.js';
import { Scalars } from '../zodql/scalars.js';

export class GraphQLSchemaGenerator {
  private generatedTypes = new Set<string>();
  private usedAWSScalars = new Set<string>();
  private usedAWSDirectives = new Set<string>();

  constructor(
    public name: string,
    public config: {
      schema: any;
      inputs?: Record<string, any>;
      queries?: Record<string, any>;
      mutations?: Record<string, any>;
      subscriptions?: Record<string, any>;
      connections?: Record<string, any>;
      relationships?: any;
      auth?: any;
      keys?: any;
    }
  ) {}

  generateSchemaFile(): string {
    const schema = this.config.schema;
    const lines: string[] = [];

    // First, discover and generate all dependencies (enums, inputs, etc.)
    this.discoverDependencies(schema);

    // Discover dependencies from inputs if provided
    if (this.config.inputs) {
      for (const inputSchema of Object.values(this.config.inputs)) {
        this.discoverDependencies(inputSchema);
      }
    }

    // Discover dependencies from queries/mutations/subscriptions
    if (this.config.queries) {
      for (const querySchema of Object.values(this.config.queries)) {
        this.discoverDependencies(querySchema);
      }
    }
    if (this.config.mutations) {
      for (const mutationSchema of Object.values(this.config.mutations)) {
        this.discoverDependencies(mutationSchema);
      }
    }
    if (this.config.subscriptions) {
      for (const subscriptionSchema of Object.values(this.config.subscriptions)) {
        this.discoverDependencies(subscriptionSchema);
      }
    }

    // Discover dependencies from connections
    if (this.config.connections) {
      for (const connectionSchema of Object.values(this.config.connections)) {
        this.discoverDependencies(connectionSchema);
      }
    }

    // Discover dependencies from keys
    if (this.config.keys) {
      if (this.config.keys.primary) {
        this.discoverDependencies(this.config.keys.primary);
      }
      if (this.config.keys.composite) {
        this.discoverDependencies(this.config.keys.composite);
      }
    }

    // Generate type definition
    if (schema instanceof z.ZodObject) {
      lines.push(`type ${this.name} {`);
      const shape = schema.shape;
      
      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        const graphqlType = this.zodTypeToGraphQL(fieldSchema as z.ZodTypeAny);
        lines.push(`  ${fieldName}: ${graphqlType}`);
      }
      
      lines.push('}');
    }

    // Generate root operations
    if (this.config.queries) {
      lines.push(this.generateRootOperations('Query', this.config.queries));
    }
    if (this.config.mutations) {
      lines.push(this.generateRootOperations('Mutation', this.config.mutations));
    }
    if (this.config.subscriptions) {
      lines.push(this.generateRootOperations('Subscription', this.config.subscriptions));
    }

    // Generate connection types
    if (this.config.connections) {
      for (const [key, connectionSchema] of Object.entries(this.config.connections)) {
        if (connectionSchema instanceof z.ZodObject) {
          // Check if it's registered
          if (Registry.has(connectionSchema)) {
            const connectionName = Registry.get(connectionSchema)!;
            if (!this.generatedTypes.has(connectionName)) {
              this.generatedTypes.add(connectionName);
              lines.push(this.generateObjectType(connectionName, connectionSchema));
            }
          } else {
            // Generate unregistered connection type - use naming convention
            const connectionName = `${this.name}Connection`;
            // Make sure we don't duplicate
            if (!this.generatedTypes.has(connectionName)) {
              this.generatedTypes.add(connectionName);
              lines.push(this.generateObjectType(connectionName, connectionSchema));
            }
          }
        }
      }
    }

    // Generate key input types
    if (this.config.keys) {
      if (this.config.keys.primary && this.config.keys.primary instanceof z.ZodObject) {
        const keyName = Registry.get(this.config.keys.primary) || 'PrimaryKeyInput';
        lines.push(this.generateInputType(keyName, this.config.keys.primary));
      }
      if (this.config.keys.composite && this.config.keys.composite instanceof z.ZodObject) {
        const keyName = Registry.get(this.config.keys.composite) || 'CompositeKeyInput';
        lines.push(this.generateInputType(keyName, this.config.keys.composite));
      }
    }

    // Track AWS directives from auth config
    if (this.config.auth) {
      for (const authRule of this.config.auth) {
        if (authRule.type === 'aws_auth' || authRule.type === '@aws_auth') {
          this.usedAWSDirectives.add('@aws_auth');
        } else if (authRule.type === 'aws_iam' || authRule.type === '@aws_iam') {
          this.usedAWSDirectives.add('@aws_iam');
        } else if (authRule.type === 'aws_api_key' || authRule.type === '@aws_api_key') {
          this.usedAWSDirectives.add('@aws_api_key');
        }
      }
    }

    // Generate AWS scalar and directive definitions
    const awsDefinitions = this.generateAWSDefinitions();

    // Prepend generated dependencies (enums, inputs, etc.)
    const dependencyLines = Array.from(this.generatedTypes)
      .map(typeName => this.generateTypeDefinition(typeName))
      .filter(Boolean);

    // Join main lines with single newline, then join all with double newline
    const mainSchema = lines.join('\n');
    const allParts = [
      ...(awsDefinitions ? [awsDefinitions] : []),
      ...dependencyLines,
      mainSchema
    ].filter(Boolean);
    
    return allParts.join('\n\n');
  }

  private discoverDependencies(zodType: z.ZodTypeAny): void {
    // Handle default values
    if (zodType instanceof z.ZodDefault) {
      this.discoverDependencies(zodType._def.innerType);
      return;
    }

    // Handle function types (for queries/mutations/subscriptions)
    if (zodType instanceof z.ZodFunction) {
      // Discover dependencies from function arguments
      const argsDef = zodType._def.args;
      if (argsDef instanceof z.ZodTuple) {
        const items = argsDef._def.items;
        if (items && items.length > 0) {
          const firstArg = items[0];
          if (firstArg instanceof z.ZodObject) {
            this.discoverDependencies(firstArg);
          }
        }
      }
      // Discover dependencies from return type
      this.discoverDependencies(zodType._def.returns);
      return;
    }

    // Handle optional types
    if (zodType instanceof z.ZodOptional) {
      this.discoverDependencies(zodType._def.innerType);
      return;
    }

    // Handle nullable types
    if (zodType instanceof z.ZodNullable) {
      this.discoverDependencies(zodType._def.innerType);
      return;
    }

    // Handle arrays
    if (zodType instanceof z.ZodArray) {
      this.discoverDependencies(zodType._def.type);
      return;
    }

    // Handle unions
    if (zodType instanceof z.ZodUnion) {
      const options = zodType._def.options;
      for (const option of options) {
        this.discoverDependencies(option);
      }
      return;
    }

    // Handle registered types FIRST (before checking if it's an object)
    // This ensures registered inputs/objects are added to generatedTypes
    if (Registry.has(zodType)) {
      const typeName = Registry.get(zodType)!;
      
      // Skip if already generated (but still discover dependencies for the main schema)
      if (this.generatedTypes.has(typeName)) {
        return;
      }

      // Skip built-in scalars
      if (typeName === 'DateTime' || typeName === 'JSON') {
        return;
      }

      // Mark as generated (unless it's the main schema, which is handled separately)
      if (typeName !== this.name) {
        this.generatedTypes.add(typeName);
      }
      
      // If it's an enum, we're done (no further dependencies)
      if (zodType instanceof z.ZodEnum) {
        return;
      }

      // If it's an object/input, discover its field dependencies
      if (zodType instanceof z.ZodObject) {
        const shape = zodType.shape;
        for (const fieldSchema of Object.values(shape)) {
          this.discoverDependencies(fieldSchema as z.ZodTypeAny);
        }
        return;
      }

      // If it's a union, discover its option dependencies
      if (zodType instanceof z.ZodUnion) {
        const options = zodType._def.options;
        for (const option of options) {
          this.discoverDependencies(option);
        }
        return;
      }
      return;
    }

    // Handle unregistered objects - discover dependencies from their fields
    if (zodType instanceof z.ZodObject) {
      const shape = zodType.shape;
      for (const fieldSchema of Object.values(shape)) {
        this.discoverDependencies(fieldSchema as z.ZodTypeAny);
      }
      return;
    }
  }

  private generateTypeDefinition(typeName: string): string | null {
    // Find the schema in the registry
    for (const [schema, name] of Registry.entries()) {
      if (name === typeName && this.generatedTypes.has(typeName)) {
        // Generate enum
        if (schema instanceof z.ZodEnum) {
          const values = schema._def.values;
          const enumLines = [`enum ${typeName} {`];
          for (const value of values) {
            enumLines.push(`  ${value}`);
          }
          enumLines.push('}');
          return enumLines.join('\n');
        }
        
        // Generate input type (check if name ends with "Input")
        if (schema instanceof z.ZodObject && typeName.endsWith('Input')) {
          return this.generateInputType(typeName, schema);
        }

        // Generate object type if registered
        if (schema instanceof z.ZodObject) {
          return this.generateObjectType(typeName, schema);
        }

        // Generate union type
        if (schema instanceof z.ZodUnion) {
          return this.generateUnionType(typeName, schema);
        }
        
        // Other types will be handled when we encounter them
        break;
      }
    }
    return null;
  }

  private zodTypeToGraphQL(zodType: z.ZodTypeAny, includeDefault: boolean = true): string {
    let innerType = zodType;
    let defaultValue: any = undefined;

    // Handle default values
    if (zodType instanceof z.ZodDefault) {
      innerType = zodType._def.innerType;
      defaultValue = zodType._def.defaultValue();
    }

    // Handle optional types
    if (innerType instanceof z.ZodOptional) {
      const baseType = this.zodTypeToGraphQL(innerType._def.innerType, false);
      const result = baseType.replace('!', '');
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }

    // Handle nullable types
    if (innerType instanceof z.ZodNullable) {
      const baseType = this.zodTypeToGraphQL(innerType._def.innerType, false);
      const result = baseType.replace('!', '');
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }

    // Handle arrays
    if (innerType instanceof z.ZodArray) {
      const elementType = this.zodTypeToGraphQL(innerType._def.type, false);
      const result = `[${elementType}]!`;
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }

    // Handle unions
    if (innerType instanceof z.ZodUnion) {
      if (Registry.has(innerType)) {
        const unionName = Registry.get(innerType)!;
        // Ensure union is added to generatedTypes
        if (!this.generatedTypes.has(unionName)) {
          this.generatedTypes.add(unionName);
        }
        const result = `${unionName}!`;
        return includeDefault && defaultValue !== undefined 
          ? `${result} = ${this.formatDefaultValue(defaultValue)}`
          : result;
      }
      // Fallback for unregistered unions
      const result = 'String!';
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }

    // Handle scalars
    if (innerType === Scalars.ID) {
      const result = 'ID!';
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }
    if (innerType === Scalars.String) {
      const result = 'String!';
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }
    if (innerType === Scalars.Int) {
      const result = 'Int!';
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }
    if (innerType === Scalars.Float) {
      const result = 'Float!';
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }
    if (innerType === Scalars.Boolean) {
      const result = 'Boolean!';
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }
    if (innerType === Scalars.DateTime) {
      this.usedAWSScalars.add('AWSDateTime');
      const result = 'AWSDateTime!'; // AWS AppSync mapping
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }
    if (innerType === Scalars.JSON) {
      this.usedAWSScalars.add('AWSJSON');
      const result = 'AWSJSON!'; // AWS AppSync mapping
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }

    // Handle registered custom types
    if (Registry.has(innerType)) {
      const typeName = Registry.get(innerType)!;
      // Check if it's a custom scalar (DateTime, JSON, etc.)
      if (typeName === 'DateTime') {
        this.usedAWSScalars.add('AWSDateTime');
        const result = 'AWSDateTime!';
        return includeDefault && defaultValue !== undefined 
          ? `${result} = ${this.formatDefaultValue(defaultValue)}`
          : result;
      }
      if (typeName === 'JSON') {
        this.usedAWSScalars.add('AWSJSON');
        const result = 'AWSJSON!';
        return includeDefault && defaultValue !== undefined 
          ? `${result} = ${this.formatDefaultValue(defaultValue)}`
          : result;
      }
      // Check for other AWS scalars
      const awsScalarMap: Record<string, string> = {
        'AWSTime': 'AWSTime',
        'AWSDate': 'AWSDate',
        'AWSEmail': 'AWSEmail',
        'AWSJSONObject': 'AWSJSONObject',
        'AWSURL': 'AWSURL',
        'AWSPhone': 'AWSPhone',
        'AWSIPAddress': 'AWSIPAddress',
      };
      if (awsScalarMap[typeName]) {
        this.usedAWSScalars.add(awsScalarMap[typeName]);
        const result = `${awsScalarMap[typeName]}!`;
        return includeDefault && defaultValue !== undefined 
          ? `${result} = ${this.formatDefaultValue(defaultValue)}`
          : result;
      }
      const result = `${typeName}!`;
      return includeDefault && defaultValue !== undefined 
        ? `${result} = ${this.formatDefaultValue(defaultValue)}`
        : result;
    }

    // Default fallback
    const result = 'String!';
    return includeDefault && defaultValue !== undefined 
      ? `${result} = ${this.formatDefaultValue(defaultValue)}`
      : result;
  }

  private formatDefaultValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      return `[${value.map(v => this.formatDefaultValue(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value).map(([k, v]) => `${k}: ${this.formatDefaultValue(v)}`);
      return `{${entries.join(', ')}}`;
    }
    return JSON.stringify(value);
  }

  private generateRootOperations(operationType: string, operations: Record<string, any>): string {
    const lines: string[] = [];
    // Use "type" instead of "extend type" since we're generating the complete type
    lines.push(`type ${operationType} {`);
    
    for (const [operationName, operationSchema] of Object.entries(operations)) {
      if (operationSchema instanceof z.ZodFunction) {
        const args = this.extractFunctionArgs(operationSchema as any);
        const returnType = this.extractFunctionReturnType(operationSchema as any);
        const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';
        lines.push(`  ${operationName}${argsStr}: ${returnType}`);
      }
    }
    
    lines.push('}');
    return lines.join('\n');
  }

  private extractFunctionArgs(funcSchema: any): string[] {
    const args: string[] = [];
    const argsDef = funcSchema._def.args;
    
    if (argsDef instanceof z.ZodTuple) {
      const items = argsDef._def.items;
      if (items && items.length > 0) {
        const firstArg = items[0];
        if (firstArg instanceof z.ZodObject) {
          const shape = firstArg.shape;
          for (const [argName, argSchema] of Object.entries(shape)) {
            const argType = this.zodTypeToGraphQL(argSchema as z.ZodTypeAny);
            args.push(`${argName}: ${argType}`);
          }
        }
      }
    }
    
    return args;
  }

  private extractFunctionReturnType(funcSchema: any): string {
    const returnType = funcSchema._def.returns;
    return this.zodTypeToGraphQL(returnType);
  }

  private generateObjectType(typeName: string, schema: any): string {
    const lines: string[] = [];
    lines.push(`type ${typeName} {`);
    const shape = schema.shape;
    
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const graphqlType = this.zodTypeToGraphQL(fieldSchema as z.ZodTypeAny);
      lines.push(`  ${fieldName}: ${graphqlType}`);
    }
    
    lines.push('}');
    return lines.join('\n');
  }

  private generateInputType(typeName: string, schema: any): string {
    const lines: string[] = [];
    lines.push(`input ${typeName} {`);
    const shape = schema.shape;
    
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const graphqlType = this.zodTypeToGraphQL(fieldSchema as z.ZodTypeAny);
      lines.push(`  ${fieldName}: ${graphqlType}`);
    }
    
    lines.push('}');
    return lines.join('\n');
  }

  private generateUnionType(typeName: string, schema: z.ZodUnion): string {
    const options = schema._def.options;
    const typeNames: string[] = [];
    
    for (const option of options) {
      if (Registry.has(option)) {
        const optionName = Registry.get(option)!;
        typeNames.push(optionName);
      } else if (option instanceof z.ZodObject) {
        // For unregistered objects, we can't generate union - this shouldn't happen
        // but we'll handle it gracefully
        typeNames.push('Unknown');
      }
    }
    
    if (typeNames.length === 0) {
      return '';
    }
    
    return `union ${typeName} = ${typeNames.join(' | ')}`;
  }

  private generateAWSDefinitions(): string | null {
    const definitions: string[] = [];

    // Generate AWS scalar definitions
    const awsScalars = [
      'AWSDateTime',
      'AWSTime',
      'AWSDate',
      'AWSEmail',
      'AWSJSON',
      'AWSJSONObject',
      'AWSURL',
      'AWSPhone',
      'AWSIPAddress',
    ];

    for (const scalar of awsScalars) {
      if (this.usedAWSScalars.has(scalar)) {
        definitions.push(`scalar ${scalar}`);
      }
    }

    // Generate AWS directive definitions
    if (this.usedAWSDirectives.has('@aws_auth')) {
      definitions.push('directive @aws_auth(...) on FIELD_DEFINITION');
    }
    if (this.usedAWSDirectives.has('@aws_iam')) {
      definitions.push('directive @aws_iam on FIELD_DEFINITION');
    }
    if (this.usedAWSDirectives.has('@aws_api_key')) {
      definitions.push('directive @aws_api_key on FIELD_DEFINITION');
    }

    return definitions.length > 0 ? definitions.join('\n') : null;
  }

  private getConnectionTypeName(key: string): string {
    // Try to find the connection type name from registry or from queries
    // Check if any query returns this connection type
    if (this.config.queries) {
      for (const [queryName, querySchema] of Object.entries(this.config.queries)) {
        if (querySchema instanceof z.ZodFunction) {
          const returnType = querySchema._def.returns;
          // If return type matches this connection schema, try to infer name
          // For now, use a simple naming convention based on the main schema name
          return `${this.name}Connection`;
        }
      }
    }
    // Fallback: capitalize first letter and add "Connection"
    return key.charAt(0).toUpperCase() + key.slice(1) + 'Connection';
  }
}

