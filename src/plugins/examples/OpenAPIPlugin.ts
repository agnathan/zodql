/**
 * =================================================================================
 * OpenAPIPlugin.ts
 * =================================================================================
 *
 * Plugin that generates OpenAPI/Swagger specification from ZodQL schemas.
 */

import { z } from 'zod';
import type { ZodQLPlugin, PluginContext, PluginOutput } from '../types.js';
import { Registry } from '../../zodql/registry.js';
import { Scalars } from '../../zodql/scalars.js';

export interface OpenAPIPluginOptions {
  /** Output directory for generated files */
  outputDir?: string;
  
  /** OpenAPI version */
  version?: '3.0.0' | '3.1.0';
  
  /** API title */
  title?: string;
  
  /** API version */
  apiVersion?: string;
  
  /** API description */
  description?: string;
  
  /** Server URLs */
  servers?: Array<{ url: string; description?: string }>;
  
  /** Base path for operations */
  basePath?: string;
}

export class OpenAPIPlugin implements ZodQLPlugin {
  metadata = {
    name: 'zodql-plugin-openapi',
    version: '1.0.0',
    description: 'Generates OpenAPI/Swagger specification from ZodQL schemas',
    keywords: ['openapi', 'swagger', 'api', 'rest'],
  };

  constructor(private options: OpenAPIPluginOptions = {}) {}

  generate(context: PluginContext): PluginOutput {
    const { config, entityName, workingDir, graphQLSchema } = context;
    const outputDir = this.options.outputDir || workingDir || './generated';
    const version = this.options.version || '3.0.0';
    const title = this.options.title || `${entityName} API`;
    const apiVersion = this.options.apiVersion || '1.0.0';
    const description = this.options.description || `OpenAPI specification for ${entityName}`;
    const servers = this.options.servers || [{ url: 'https://api.example.com' }];
    const basePath = this.options.basePath || '';

    const spec: any = {
      openapi: version,
      info: {
        title,
        version: apiVersion,
        description,
      },
      servers,
      paths: {},
      components: {
        schemas: {},
      },
    };

    // Generate schemas from types
    this.generateSchemas(config, spec.components.schemas, context);

    // Generate query endpoints
    if (config.queries) {
      for (const [name, queryFn] of Object.entries(config.queries)) {
        const path = this.generateQueryPath(name, queryFn, basePath, spec.components.schemas, context);
        Object.assign(spec.paths, path);
      }
    }

    // Generate mutation endpoints
    if (config.mutations) {
      for (const [name, mutationFn] of Object.entries(config.mutations)) {
        const path = this.generateMutationPath(name, mutationFn, basePath, spec.components.schemas, context);
        Object.assign(spec.paths, path);
      }
    }

    const files: Array<{ path: string; content: string }> = [
      {
        path: `${outputDir}/openapi.json`,
        content: JSON.stringify(spec, null, 2),
      },
      {
        path: `${outputDir}/openapi.yaml`,
        content: this.toYAML(spec),
      },
    ];

    return {
      files,
      logs: [`Generated OpenAPI ${version} specification for entity: ${entityName}`],
      metadata: {
        openapiVersion: version,
        entityName,
        pathCount: Object.keys(spec.paths).length,
        schemaCount: Object.keys(spec.components.schemas).length,
      },
    };
  }

  private generateSchemas(
    config: any,
    schemas: Record<string, any>,
    context: PluginContext
  ): void {
    // Generate schema for main entity
    if (config.schema instanceof z.ZodObject) {
      const schemaName = context.entityName;
      schemas[schemaName] = this.zodToOpenAPISchema(config.schema, context);
    }

    // Generate schemas for inputs
    if (config.inputs) {
      for (const [name, inputSchema] of Object.entries(config.inputs)) {
        if (inputSchema instanceof z.ZodObject) {
          schemas[name] = this.zodToOpenAPISchema(inputSchema, context);
        }
      }
    }
  }

  private generateQueryPath(
    name: string,
    queryFn: z.ZodFunction<any, any>,
    basePath: string,
    schemas: Record<string, any>,
    context: PluginContext
  ): Record<string, any> {
    const args = this.extractArgs(queryFn, context);
    const returnType = this.extractReturnType(queryFn, context);
    const path = `${basePath}/${name}`;

    const parameters = args.map(arg => ({
      name: arg.name,
      in: 'query' as const,
      required: arg.required,
      schema: this.zodToOpenAPISchema(arg.zodType, context),
    }));

    const responseSchema = this.zodToOpenAPISchema(returnType, context);

    return {
      [path]: {
        get: {
          summary: `Query ${name}`,
          operationId: name,
          parameters,
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: responseSchema,
                },
              },
            },
          },
        },
      },
    };
  }

  private generateMutationPath(
    name: string,
    mutationFn: z.ZodFunction<any, any>,
    basePath: string,
    schemas: Record<string, any>,
    context: PluginContext
  ): Record<string, any> {
    const args = this.extractArgs(mutationFn, context);
    const returnType = this.extractReturnType(mutationFn, context);
    const path = `${basePath}/${name}`;

    // Find input argument
    const inputArg = args.find(arg => arg.name === 'input' || arg.name === 'data');
    const requestBody = inputArg
      ? {
          required: inputArg.required,
          content: {
            'application/json': {
              schema: this.zodToOpenAPISchema(inputArg.zodType, context),
            },
          },
        }
      : undefined;

    const responseSchema = this.zodToOpenAPISchema(returnType, context);

    return {
      [path]: {
        post: {
          summary: `Mutation ${name}`,
          operationId: name,
          requestBody,
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: responseSchema,
                },
              },
            },
          },
        },
      },
    };
  }

  private extractArgs(
    operationFn: z.ZodFunction<any, any>,
    context: PluginContext
  ): Array<{ name: string; zodType: z.ZodTypeAny; required: boolean }> {
    const args: Array<{ name: string; zodType: z.ZodTypeAny; required: boolean }> = [];
    const argsDef = operationFn._def.args;

    if (argsDef instanceof z.ZodTuple && argsDef._def.items.length > 0) {
      const firstArg = argsDef._def.items[0];
      if (firstArg instanceof z.ZodObject) {
        for (const [name, schema] of Object.entries(firstArg.shape)) {
          const zodType = schema as z.ZodTypeAny;
          const required = !(zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable);
          args.push({ name, zodType, required });
        }
      }
    }

    return args;
  }

  private extractReturnType(operationFn: z.ZodFunction<any, any>): z.ZodTypeAny {
    return operationFn._def.returns;
  }

  private zodToOpenAPISchema(zodType: z.ZodTypeAny, context: PluginContext): any {
    // Handle optionals/nullables
    if (zodType instanceof z.ZodOptional) {
      return this.zodToOpenAPISchema(zodType._def.innerType, context);
    }
    if (zodType instanceof z.ZodNullable) {
      const inner = this.zodToOpenAPISchema(zodType._def.innerType, context);
      return { ...inner, nullable: true };
    }

    // Handle arrays
    if (zodType instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodToOpenAPISchema(zodType._def.type, context),
      };
    }

    // Handle objects
    if (zodType instanceof z.ZodObject) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(zodType.shape)) {
        const fieldType = value as z.ZodTypeAny;
        properties[key] = this.zodToOpenAPISchema(fieldType, context);
        
        if (!(fieldType instanceof z.ZodOptional || fieldType instanceof z.ZodNullable)) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    // Handle registered types (references)
    if (Registry.has(zodType)) {
      const typeName = Registry.get(zodType)!;
      return { $ref: `#/components/schemas/${typeName}` };
    }

    // Handle scalars
    if (zodType === Scalars.ID || zodType === Scalars.String) {
      return { type: 'string' };
    }
    if (zodType === Scalars.Int) {
      return { type: 'integer', format: 'int32' };
    }
    if (zodType === Scalars.Float) {
      return { type: 'number', format: 'float' };
    }
    if (zodType === Scalars.Boolean) {
      return { type: 'boolean' };
    }

    return { type: 'string' }; // Fallback
  }

  private toYAML(obj: any, indent = 0): string {
    const indentStr = '  '.repeat(indent);
    let yaml = '';

    if (Array.isArray(obj)) {
      for (const item of obj) {
        yaml += `${indentStr}- ${this.toYAML(item, indent + 1)}\n`;
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
          continue;
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
          yaml += `${indentStr}${key}:\n${this.toYAML(value, indent + 1)}`;
        } else {
          yaml += `${indentStr}${key}: ${this.toYAML(value, indent)}\n`;
        }
      }
    } else {
      if (typeof obj === 'string') {
        return `"${obj.replace(/"/g, '\\"')}"`;
      }
      return String(obj);
    }

    return yaml;
  }
}
