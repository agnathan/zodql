/**
 * =================================================================================
 * PluginManager.ts
 * =================================================================================
 *
 * Manages plugin discovery, loading, and execution.
 * Coordinates plugin lifecycle and provides context to plugins.
 */

import { GraphQLSchemaGenerator, GeneratorConfig } from '../generators/GraphQLSchemaGenerator.js';
import { Registry } from '../zodql/registry.js';
import type {
  ZodQLPlugin,
  PluginContext,
  PluginOutput,
  PluginExecutionResult,
  PluginManagerOptions,
} from './types.js';

/**
 * Manages ZodQL plugins: discovery, loading, and execution.
 */
export class PluginManager {
  private plugins: ZodQLPlugin[] = [];
  private options: Required<PluginManagerOptions>;

  constructor(options: PluginManagerOptions = {}) {
    this.options = {
      workingDir: options.workingDir || process.cwd(),
      continueOnError: options.continueOnError ?? true,
      parallel: options.parallel ?? false,
      contextExtensions: options.contextExtensions || {},
    };
  }

  /**
   * Register a plugin.
   */
  register(plugin: ZodQLPlugin): void {
    // Validate plugin
    if (!plugin.metadata || !plugin.metadata.name || !plugin.metadata.version) {
      throw new Error('Plugin must have valid metadata with name and version');
    }

    if (!plugin.generate || typeof plugin.generate !== 'function') {
      throw new Error('Plugin must implement generate() method');
    }

    // Check for duplicates
    if (this.plugins.some((p) => p.metadata.name === plugin.metadata.name)) {
      throw new Error(`Plugin ${plugin.metadata.name} is already registered`);
    }

    this.plugins.push(plugin);
  }

  /**
   * Register multiple plugins.
   */
  registerAll(plugins: ZodQLPlugin[]): void {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  /**
   * Get all registered plugins.
   */
  getPlugins(): ZodQLPlugin[] {
    return [...this.plugins];
  }

  /**
   * Get a plugin by name.
   */
  getPlugin(name: string): ZodQLPlugin | undefined {
    return this.plugins.find((p) => p.metadata.name === name);
  }

  /**
   * Execute all registered plugins with the given generator.
   */
  async runPlugins(
    generator: GraphQLSchemaGenerator,
    options?: { generateSchema?: boolean }
  ): Promise<PluginExecutionResult[]> {
    const results: PluginExecutionResult[] = [];
    const generateSchema = options?.generateSchema ?? true;

    // Generate GraphQL schema if needed
    const graphQLSchema = generateSchema ? generator.generateSchemaFile() : undefined;

    // Create base context
    const baseContext: PluginContext = {
      generator,
      config: generator.config,
      entityName: generator.name,
      graphQLSchema,
      registry: Registry,
      workingDir: this.options.workingDir,
      shared: new Map(),
      ...this.options.contextExtensions,
    };

    // Sort plugins by dependencies
    const sortedPlugins = this.sortPluginsByDependencies(this.plugins);

    // Execute plugins
    if (this.options.parallel) {
      const promises = sortedPlugins.map((plugin) =>
        this.executePlugin(plugin, baseContext)
      );
      const parallelResults = await Promise.allSettled(promises);
      
      for (let i = 0; i < parallelResults.length; i++) {
        const result = parallelResults[i];
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const plugin = sortedPlugins[i];
          results.push({
            plugin: plugin.metadata,
            output: { errors: [result.reason?.message || 'Unknown error'] },
            duration: 0,
            success: false,
            error: result.reason,
          });
        }
      }
    } else {
      // Sequential execution
      for (const plugin of sortedPlugins) {
        const result = await this.executePlugin(plugin, baseContext);
        results.push(result);

        // Update shared context with plugin output
        if (result.output.shared) {
          for (const [key, value] of Object.entries(result.output.shared)) {
            baseContext.shared!.set(key, value);
          }
        }

        // Stop on error if continueOnError is false
        if (!result.success && !this.options.continueOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute a single plugin.
   */
  private async executePlugin(
    plugin: ZodQLPlugin,
    baseContext: PluginContext
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();
    const context: PluginContext = { ...baseContext };

    try {
      // Validate plugin
      if (plugin.validate) {
        const validation = plugin.validate(context);
        if (validation !== true) {
          throw new Error(`Plugin validation failed: ${validation}`);
        }
      }

      // Call beforeGenerate hook
      if (plugin.beforeGenerate) {
        await plugin.beforeGenerate(context);
      }

      // Execute plugin
      const output = await Promise.resolve(plugin.generate(context));

      // Call afterGenerate hook
      if (plugin.afterGenerate) {
        await plugin.afterGenerate(context, output);
      }

      const duration = Date.now() - startTime;

      return {
        plugin: plugin.metadata,
        output,
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        plugin: plugin.metadata,
        output: {
          errors: [error instanceof Error ? error.message : String(error)],
        },
        duration,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Sort plugins by dependencies (topological sort).
   * Plugins with dependencies run after their dependencies.
   */
  private sortPluginsByDependencies(plugins: ZodQLPlugin[]): ZodQLPlugin[] {
    const sorted: ZodQLPlugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (plugin: ZodQLPlugin): void => {
      const name = plugin.metadata.name;

      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving plugin: ${name}`);
      }

      if (visited.has(name)) {
        return;
      }

      visiting.add(name);

      // Visit dependencies first
      if (plugin.metadata.dependencies) {
        for (const depName of plugin.metadata.dependencies) {
          const depPlugin = this.plugins.find((p) => p.metadata.name === depName);
          if (depPlugin) {
            visit(depPlugin);
          } else {
            console.warn(`Plugin ${name} depends on ${depName}, but it's not registered`);
          }
        }
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(plugin);
    };

    for (const plugin of plugins) {
      if (!visited.has(plugin.metadata.name)) {
        visit(plugin);
      }
    }

    return sorted;
  }

  /**
   * Clear all registered plugins.
   */
  clear(): void {
    this.plugins = [];
  }
}
