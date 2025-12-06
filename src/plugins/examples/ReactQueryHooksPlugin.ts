/**
 * =================================================================================
 * ReactQueryHooksPlugin.ts
 * =================================================================================
 *
 * Plugin that generates React Query hooks (useQuery, useMutation, useSubscription)
 * from ZodQL schemas.
 */

import { z } from 'zod';
import type { ZodQLPlugin, PluginContext, PluginOutput } from '../types.js';
import { Registry } from '../../zodql/registry.js';
import { Scalars } from '../../zodql/scalars.js';

export interface ReactQueryHooksPluginOptions {
  /** Output directory for generated files */
  outputDir?: string;
  
  /** Whether to generate TypeScript types */
  generateTypes?: boolean;
  
  /** React Query version */
  reactQueryVersion?: 'v4' | 'v5';
  
  /** Custom hook prefix */
  hookPrefix?: string;
  
  /** Whether to generate suspense hooks */
  generateSuspense?: boolean;
}

export class ReactQueryHooksPlugin implements ZodQLPlugin {
  metadata = {
    name: 'zodql-plugin-react-query',
    version: '1.0.0',
    description: 'Generates React Query hooks from ZodQL schemas',
    keywords: ['react', 'react-query', 'tanstack-query', 'hooks'],
  };

  constructor(private options: ReactQueryHooksPluginOptions = {}) {}

  validate(context: PluginContext): boolean | string {
    const { config } = context;
    
    if (!config.queries && !config.mutations && !config.subscriptions) {
      return 'No operations found in schema';
    }
    
    return true;
  }

  generate(context: PluginContext): PluginOutput {
    const { config, entityName, workingDir } = context;
    const outputDir = this.options.outputDir || workingDir || './generated';
    const generateTypes = this.options.generateTypes ?? true;
    const reactQueryVersion = this.options.reactQueryVersion || 'v5';
    const hookPrefix = this.options.hookPrefix || 'use';
    const generateSuspense = this.options.generateSuspense ?? false;

    const hooks: string[] = [];
    const types: string[] = [];
    const imports = new Set<string>();

    // Generate query hooks
    if (config.queries) {
      for (const [name, queryFn] of Object.entries(config.queries)) {
        const hook = this.generateQueryHook(name, queryFn, context, hookPrefix, reactQueryVersion, generateSuspense);
        hooks.push(hook.code);
        if (generateTypes) {
          types.push(hook.types);
        }
        hook.imports.forEach(imp => imports.add(imp));
      }
    }

    // Generate mutation hooks
    if (config.mutations) {
      for (const [name, mutationFn] of Object.entries(config.mutations)) {
        const hook = this.generateMutationHook(name, mutationFn, context, hookPrefix, reactQueryVersion);
        hooks.push(hook.code);
        if (generateTypes) {
          types.push(hook.types);
        }
        hook.imports.forEach(imp => imports.add(imp));
      }
    }

    // Generate subscription hooks
    if (config.subscriptions) {
      for (const [name, subFn] of Object.entries(config.subscriptions)) {
        const hook = this.generateSubscriptionHook(name, subFn, context, hookPrefix);
        hooks.push(hook.code);
        if (generateTypes) {
          types.push(hook.types);
        }
        hook.imports.forEach(imp => imports.add(imp));
      }
    }

    const files: Array<{ path: string; content: string }> = [];

    // Generate hooks file
    files.push({
      path: `${outputDir}/hooks.ts`,
      content: this.formatHooksFile(hooks, Array.from(imports), reactQueryVersion),
    });

    // Generate types file
    if (generateTypes) {
      files.push({
        path: `${outputDir}/hooks-types.ts`,
        content: this.formatTypesFile(types),
      });
    }

    return {
      files,
      logs: [`Generated ${hooks.length} React Query hooks for entity: ${entityName}`],
      metadata: {
        hookCount: hooks.length,
        entityName,
        reactQueryVersion,
      },
    };
  }

  private generateQueryHook(
    name: string,
    queryFn: z.ZodFunction<any, any>,
    context: PluginContext,
    prefix: string,
    version: 'v4' | 'v5',
    suspense: boolean
  ): { code: string; types: string; imports: string[] } {
    const args = this.extractArgs(queryFn, context);
    const returnType = this.extractReturnType(queryFn, context);
    const hookName = `${prefix}${this.toPascalCase(name)}`;
    const variableType = `${this.toPascalCase(name)}Variables`;
    const responseType = `${this.toPascalCase(name)}Response`;

    const argsStr = args.length > 0 ? `variables: ${variableType}` : '';
    const queryKey = args.length > 0 
      ? `['${name}', variables]`
      : `['${name}']`;

    const imports = version === 'v5' 
      ? ['useQuery', 'UseQueryOptions']
      : ['useQuery', 'UseQueryOptions'];

    let code = '';
    if (suspense) {
      code = `export function ${hookName}(${argsStr}) {
  return useQuery({
    queryKey: ${queryKey},
    queryFn: () => fetch${this.toPascalCase(name)}(${args.length > 0 ? 'variables' : ''}),
    suspense: true,
  });
}`;
    } else {
      code = `export function ${hookName}(${argsStr}, options?: UseQueryOptions<${responseType}>) {
  return useQuery({
    queryKey: ${queryKey},
    queryFn: () => fetch${this.toPascalCase(name)}(${args.length > 0 ? 'variables' : ''}),
    ...options,
  });
}`;
    }

    const types = `
export interface ${variableType} {
${args.map(a => `  ${a.name}${a.required ? '' : '?'}: ${a.tsType};`).join('\n')}
}

export interface ${responseType} {
  ${name}: ${this.getTypeScriptType(returnType, context)};
}
`;

    return { code, types, imports };
  }

  private generateMutationHook(
    name: string,
    mutationFn: z.ZodFunction<any, any>,
    context: PluginContext,
    prefix: string,
    version: 'v4' | 'v5'
  ): { code: string; types: string; imports: string[] } {
    const args = this.extractArgs(mutationFn, context);
    const returnType = this.extractReturnType(mutationFn, context);
    const hookName = `${prefix}${this.toPascalCase(name)}`;
    const variableType = `${this.toPascalCase(name)}Variables`;
    const responseType = `${this.toPascalCase(name)}Response`;

    const argsStr = args.length > 0 ? `variables: ${variableType}` : '';
    const mutationKey = `['${name}']`;

    const imports = version === 'v5'
      ? ['useMutation', 'UseMutationOptions']
      : ['useMutation', 'UseMutationOptions'];

    const code = `export function ${hookName}(options?: UseMutationOptions<${responseType}, Error, ${args.length > 0 ? variableType : 'void'>) {
  return useMutation({
    mutationKey: ${mutationKey},
    mutationFn: (${args.length > 0 ? 'variables' : ''}) => execute${this.toPascalCase(name)}(${args.length > 0 ? 'variables' : ''}),
    ...options,
  });
}`;

    const types = `
export interface ${variableType} {
${args.map(a => `  ${a.name}${a.required ? '' : '?'}: ${a.tsType};`).join('\n')}
}

export interface ${responseType} {
  ${name}: ${this.getTypeScriptType(returnType, context)};
}
`;

    return { code, types, imports };
  }

  private generateSubscriptionHook(
    name: string,
    subFn: z.ZodFunction<any, any>,
    context: PluginContext,
    prefix: string
  ): { code: string; types: string; imports: string[] } {
    const args = this.extractArgs(subFn, context);
    const returnType = this.extractReturnType(subFn, context);
    const hookName = `${prefix}${this.toPascalCase(name)}`;
    const variableType = `${this.toPascalCase(name)}Variables`;
    const responseType = `${this.toPascalCase(name)}Response`;

    const argsStr = args.length > 0 ? `variables: ${variableType}` : '';

    const code = `export function ${hookName}(${argsStr}, callback: (data: ${responseType}) => void) {
  // Note: React Query doesn't have built-in subscription support
  // You'll need to use a GraphQL subscription client (e.g., Apollo, urql)
  // This is a placeholder implementation
  return subscribe${this.toPascalCase(name)}(${args.length > 0 ? 'variables' : ''}, callback);
}`;

    const types = `
export interface ${variableType} {
${args.map(a => `  ${a.name}${a.required ? '' : '?'}: ${a.tsType};`).join('\n')}
}

export interface ${responseType} {
  ${name}: ${this.getTypeScriptType(returnType, context)};
}
`;

    return { code, types, imports: ['useEffect'] };
  }

  private extractArgs(
    operationFn: z.ZodFunction<any, any>,
    context: PluginContext
  ): Array<{ name: string; tsType: string; required: boolean }> {
    const args: Array<{ name: string; tsType: string; required: boolean }> = [];
    const argsDef = operationFn._def.args;

    if (argsDef instanceof z.ZodTuple && argsDef._def.items.length > 0) {
      const firstArg = argsDef._def.items[0];
      if (firstArg instanceof z.ZodObject) {
        for (const [name, schema] of Object.entries(firstArg.shape)) {
          const zodType = schema as z.ZodTypeAny;
          const tsType = this.getTypeScriptType(zodType, context);
          const required = !(zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable);
          args.push({ name, tsType, required });
        }
      }
    }

    return args;
  }

  private extractReturnType(operationFn: z.ZodFunction<any, any>): z.ZodTypeAny {
    return operationFn._def.returns;
  }

  private getTypeScriptType(zodType: z.ZodTypeAny, context: PluginContext): string {
    if (zodType instanceof z.ZodOptional) {
      return `${this.getTypeScriptType(zodType._def.innerType, context)} | undefined`;
    }
    if (zodType instanceof z.ZodNullable) {
      return `${this.getTypeScriptType(zodType._def.innerType, context)} | null`;
    }
    if (zodType instanceof z.ZodArray) {
      return `${this.getTypeScriptType(zodType._def.type, context)}[]`;
    }

    if (Registry.has(zodType)) {
      return Registry.get(zodType)!;
    }

    if (zodType === Scalars.ID) return 'string';
    if (zodType === Scalars.String) return 'string';
    if (zodType === Scalars.Int) return 'number';
    if (zodType === Scalars.Float) return 'number';
    if (zodType === Scalars.Boolean) return 'boolean';

    return 'any';
  }

  private formatHooksFile(hooks: string[], imports: string[], version: 'v4' | 'v5'): string {
    const importPath = version === 'v5' 
      ? '@tanstack/react-query'
      : 'react-query';

    return `/**
 * Generated React Query Hooks
 * This file is auto-generated. Do not edit manually.
 */

import { ${imports.join(', ')} } from '${importPath}';

${hooks.join('\n\n')}
`;
  }

  private formatTypesFile(types: string[]): string {
    return `/**
 * Generated TypeScript Types for React Query Hooks
 * This file is auto-generated. Do not edit manually.
 */

${types.join('\n')}
`;
  }

  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
