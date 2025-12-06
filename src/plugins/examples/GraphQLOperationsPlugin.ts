/**
 * =================================================================================
 * GraphQLOperationsPlugin.ts
 * =================================================================================
 *
 * Example plugin that generates GraphQL operations (queries, mutations, subscriptions)
 * from a ZodQL schema.
 *
 * This serves as a reference implementation for creating custom plugins.
 */

import { z } from 'zod';
import type { ZodQLPlugin, PluginContext, PluginOutput } from '../types.js';
import { GraphQLSchemaGenerator } from '../../generators/GraphQLSchemaGenerator.js';
import { Registry } from '../../zodql/registry.js';
import { Scalars } from '../../zodql/scalars.js';

/**
 * Options for the GraphQL Operations Plugin.
 */
export interface GraphQLOperationsPluginOptions {
  /** Output directory for generated files */
  outputDir?: string;
  
  /** Output format */
  format?: 'typescript' | 'javascript';
  
  /** Whether to generate TypeScript types */
  generateTypes?: boolean;
  
  /** Whether to generate operation documents */
  generateDocuments?: boolean;
  
  /** Client library to generate for */
  client?: 'apollo' | 'urql' | 'react-query' | 'vanilla';
  
  /** File naming convention */
  fileNaming?: 'camelCase' | 'kebab-case' | 'PascalCase';
}

/**
 * Plugin that generates GraphQL operations from ZodQL schemas.
 */
export class GraphQLOperationsPlugin implements ZodQLPlugin {
  metadata = {
    name: 'zodql-plugin-operations',
    version: '1.0.0',
    description: 'Generates GraphQL operations (queries, mutations, subscriptions) from ZodQL schemas',
    keywords: ['graphql', 'operations', 'queries', 'mutations', 'subscriptions'],
  };

  configSchema = {
    outputDir: {
      type: 'string' as const,
      description: 'Output directory for generated files',
      default: './generated',
    },
    format: {
      type: 'string' as const,
      description: 'Output format',
      default: 'typescript',
      enum: ['typescript', 'javascript'],
    },
    generateTypes: {
      type: 'boolean' as const,
      description: 'Whether to generate TypeScript types',
      default: true,
    },
    generateDocuments: {
      type: 'boolean' as const,
      description: 'Whether to generate operation documents',
      default: true,
    },
    client: {
      type: 'string' as const,
      description: 'Client library to generate for',
      default: 'vanilla',
      enum: ['apollo', 'urql', 'react-query', 'vanilla'],
    },
  };

  constructor(private options: GraphQLOperationsPluginOptions = {}) {}

  validate(context: PluginContext): boolean | string {
    const { config } = context;
    
    if (!config.queries && !config.mutations && !config.subscriptions) {
      return 'No operations found in schema (queries, mutations, or subscriptions)';
    }
    
    return true;
  }

  generate(context: PluginContext): PluginOutput {
    const { config, entityName, workingDir } = context;
    const outputDir = this.options.outputDir || workingDir || './generated';
    const format = this.options.format || 'typescript';
    const generateTypes = this.options.generateTypes ?? true;
    const generateDocuments = this.options.generateDocuments ?? true;

    const files: Array<{ path: string; content: string }> = [];
    const operations: string[] = [];
    const types: string[] = [];

    // Generate queries
    if (config.queries) {
      for (const [name, queryFn] of Object.entries(config.queries)) {
        const operation = this.generateOperation('query', name, queryFn, context);
        operations.push(operation.document);
        if (generateTypes) {
          types.push(operation.types);
        }
      }
    }

    // Generate mutations
    if (config.mutations) {
      for (const [name, mutationFn] of Object.entries(config.mutations)) {
        const operation = this.generateOperation('mutation', name, mutationFn, context);
        operations.push(operation.document);
        if (generateTypes) {
          types.push(operation.types);
        }
      }
    }

    // Generate subscriptions
    if (config.subscriptions) {
      for (const [name, subFn] of Object.entries(config.subscriptions)) {
        const operation = this.generateOperation('subscription', name, subFn, context);
        operations.push(operation.document);
        if (generateTypes) {
          types.push(operation.types);
        }
      }
    }

    // Generate operations file
    if (generateDocuments) {
      files.push({
        path: `${outputDir}/operations.${format === 'typescript' ? 'ts' : 'js'}`,
        content: this.formatOperationsFile(operations, format),
      });
    }

    // Generate types file
    if (generateTypes && format === 'typescript') {
      files.push({
        path: `${outputDir}/operation-types.ts`,
        content: this.formatTypesFile(types),
      });
    }

    return {
      files,
      logs: [`Generated ${operations.length} operations for entity: ${entityName}`],
      metadata: {
        operationCount: operations.length,
        entityName,
        format,
      },
    };
  }

  /**
   * Generate a single operation (query, mutation, or subscription).
   */
  private generateOperation(
    type: 'query' | 'mutation' | 'subscription',
    name: string,
    operationFn: z.ZodFunction<any, any>,
    context: PluginContext
  ): { document: string; types: string } {
    const args = this.extractOperationArgs(operationFn, context);
    const returnType = this.extractReturnType(operationFn, context);
    
    const operationName = this.toPascalCase(name);
    const variableName = `${operationName}Variables`;
    const responseName = `${operationName}Response`;

    // Generate GraphQL operation document
    const argsStr = args.length > 0 
      ? `(${args.map(a => `$${a.name}: ${a.type}${a.required ? '!' : ''}`).join(', ')})`
      : '';
    const fieldsStr = this.generateSelectionSet(returnType, context);
    
    const document = `${type} ${operationName}${argsStr} {
  ${name}${args.length > 0 ? `(${args.map(a => `${a.name}: $${a.name}`).join(', ')})` : ''} {
${fieldsStr}
  }
}`;

    // Generate TypeScript types
    const format = this.options.format || 'typescript';
    const types = format === 'typescript' ? `
export interface ${variableName} {
${args.map(a => `  ${a.name}${a.required ? '' : '?'}: ${a.tsType};`).join('\n')}
}

export interface ${responseName} {
  ${name}: ${this.getTypeScriptType(returnType, context)};
}
` : '';

    return { document, types };
  }

  /**
   * Extract operation arguments from a ZodFunction.
   */
  private extractOperationArgs(
    operationFn: z.ZodFunction<any, any>,
    context: PluginContext
  ): Array<{ name: string; type: string; tsType: string; required: boolean }> {
    const args: Array<{ name: string; type: string; tsType: string; required: boolean }> = [];
    const argsDef = operationFn._def.args;

    if (argsDef instanceof z.ZodTuple && argsDef._def.items.length > 0) {
      const firstArg = argsDef._def.items[0];
      if (firstArg instanceof z.ZodObject) {
        for (const [name, schema] of Object.entries(firstArg.shape)) {
          const zodType = schema as z.ZodTypeAny;
          const graphQLType = this.zodToGraphQLType(zodType, context);
          const tsType = this.getTypeScriptType(zodType, context);
          const required = !(zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable);
          
          args.push({ name, type: graphQLType, tsType, required });
        }
      }
    }

    return args;
  }

  /**
   * Extract return type from a ZodFunction.
   */
  private extractReturnType(
    operationFn: z.ZodFunction<any, any>,
    context: PluginContext
  ): z.ZodTypeAny {
    return operationFn._def.returns;
  }

  /**
   * Generate selection set for a type.
   */
  private generateSelectionSet(
    zodType: z.ZodTypeAny,
    context: PluginContext,
    depth: number = 0
  ): string {
    if (depth > 2) {
      return '    __typename'; // Prevent infinite recursion
    }

    // Unwrap optionals/nullables/arrays
    let innerType = zodType;
    if (zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable) {
      innerType = zodType._def.innerType;
    }
    if (innerType instanceof z.ZodArray) {
      innerType = innerType._def.type;
    }

    // If it's a registered object type, generate fields
    if (innerType instanceof z.ZodObject && Registry.has(innerType)) {
      const indent = '    '.repeat(depth + 1);
      const fields: string[] = [];
      
      for (const [fieldName, fieldSchema] of Object.entries(innerType.shape)) {
        const fieldZodType = fieldSchema as z.ZodTypeAny;
        const nested = this.generateSelectionSet(fieldZodType, context, depth + 1);
        fields.push(`${indent}${fieldName}${nested.includes('\n') ? ` {\n${nested}\n${indent}}` : ''}`);
      }
      
      return fields.length > 0 ? fields.join('\n') : '    __typename';
    }

    return ''; // Scalar type, no selection needed
  }

  /**
   * Convert Zod type to GraphQL type string.
   */
  private zodToGraphQLType(zodType: z.ZodTypeAny, context: PluginContext): string {
    // Handle wrappers
    if (zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable) {
      return this.zodToGraphQLType(zodType._def.innerType, context);
    }
    if (zodType instanceof z.ZodArray) {
      return `[${this.zodToGraphQLType(zodType._def.type, context)}!]!`;
    }

    // Handle registered types
    if (Registry.has(zodType)) {
      const typeName = Registry.get(zodType)!;
      return typeName;
    }

    // Handle scalars
    if (zodType === Scalars.ID) return 'ID';
    if (zodType === Scalars.String) return 'String';
    if (zodType === Scalars.Int) return 'Int';
    if (zodType === Scalars.Float) return 'Float';
    if (zodType === Scalars.Boolean) return 'Boolean';

    return 'String'; // Fallback
  }

  /**
   * Get TypeScript type string for a Zod type.
   */
  private getTypeScriptType(zodType: z.ZodTypeAny, context: PluginContext): string {
    // Handle wrappers
    if (zodType instanceof z.ZodOptional) {
      return `${this.getTypeScriptType(zodType._def.innerType, context)} | undefined`;
    }
    if (zodType instanceof z.ZodNullable) {
      return `${this.getTypeScriptType(zodType._def.innerType, context)} | null`;
    }
    if (zodType instanceof z.ZodArray) {
      return `${this.getTypeScriptType(zodType._def.type, context)}[]`;
    }

    // Handle registered types
    if (Registry.has(zodType)) {
      const typeName = Registry.get(zodType)!;
      return typeName;
    }

    // Handle scalars
    if (zodType === Scalars.ID) return 'string';
    if (zodType === Scalars.String) return 'string';
    if (zodType === Scalars.Int) return 'number';
    if (zodType === Scalars.Float) return 'number';
    if (zodType === Scalars.Boolean) return 'boolean';

    return 'any'; // Fallback
  }

  /**
   * Format operations file content.
   */
  private formatOperationsFile(operations: string[], format: 'typescript' | 'javascript'): string {
    const header = format === 'typescript'
      ? `/**
 * Generated GraphQL Operations
 * This file is auto-generated. Do not edit manually.
 */

`
      : `/**
 * Generated GraphQL Operations
 * This file is auto-generated. Do not edit manually.
 */

`;

    return header + operations.join('\n\n');
  }

  /**
   * Format types file content.
   */
  private formatTypesFile(types: string[]): string {
    return `/**
 * Generated TypeScript Types for GraphQL Operations
 * This file is auto-generated. Do not edit manually.
 */

${types.join('\n')}
`;
  }

  /**
   * Convert string to PascalCase.
   */
  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
