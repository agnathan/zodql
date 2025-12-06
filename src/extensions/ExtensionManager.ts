import type { SchemaExtension, ExtensionContext, ExtensionManagerOptions, ExtensionTransformResult } from './types.js';
import { GenerationPhase } from './types.js';
import type { GeneratorConfig } from '../generators/GraphQLSchemaGenerator.js';
import { Registry } from '../zodql/registry.js';

/**
 * =================================================================================
 * Extension Manager
 * =================================================================================
 *
 * Manages schema extensions and coordinates their lifecycle hooks.
 * Handles dependency resolution, execution order, and error handling.
 */

export class ExtensionManager {
  private extensions = new Map<string, SchemaExtension>();
  private executionOrder: string[] = [];
  private continueOnError: boolean;

  constructor(options: ExtensionManagerOptions = {}) {
    this.continueOnError = options.continueOnError ?? true;
    
    if (options.extensions) {
      for (const extension of options.extensions) {
        this.registerExtension(extension);
      }
    }
    
    // Build execution order based on dependencies
    this.buildExecutionOrder(options.executionOrder);
  }

  /**
   * Register an extension
   */
  registerExtension(extension: SchemaExtension): void {
    if (this.extensions.has(extension.name)) {
      throw new Error(`Extension "${extension.name}" is already registered`);
    }
    this.extensions.set(extension.name, extension);
    // Rebuild execution order when new extension is added
    this.buildExecutionOrder();
  }

  /**
   * Build execution order based on dependencies (topological sort)
   */
  private buildExecutionOrder(customOrder?: string[]): void {
    if (customOrder) {
      // Validate custom order contains all extensions
      const extensionNames = Array.from(this.extensions.keys());
      const missing = extensionNames.filter(name => !customOrder.includes(name));
      if (missing.length > 0) {
        throw new Error(`Custom execution order is missing extensions: ${missing.join(', ')}`);
      }
      this.executionOrder = customOrder;
      return;
    }

    // Topological sort based on dependencies
    const visited = new Set<string>();
    const tempMark = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (tempMark.has(name)) {
        throw new Error(`Circular dependency detected involving extension "${name}"`);
      }
      if (visited.has(name)) {
        return;
      }

      tempMark.add(name);
      const extension = this.extensions.get(name);
      if (extension?.dependencies) {
        for (const dep of extension.dependencies) {
          if (!this.extensions.has(dep)) {
            throw new Error(`Extension "${name}" depends on unknown extension "${dep}"`);
          }
          visit(dep);
        }
      }
      tempMark.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.extensions.keys()) {
      if (!visited.has(name)) {
        visit(name);
      }
    }

    this.executionOrder = order;
  }

  /**
   * Execute extensions for a specific phase
   */
  private async executePhase(
    phase: GenerationPhase,
    context: ExtensionContext,
    schemaSDL?: string
  ): Promise<{ config: GeneratorConfig; schemaSDL?: string }> {
    let config = context.config;
    let finalSchemaSDL = schemaSDL;

    for (const extensionName of this.executionOrder) {
      const extension = this.extensions.get(extensionName);
      if (!extension) continue;

      const phaseContext: ExtensionContext = {
        ...context,
        config,
        phase,
      };

      try {
        // Validate extension if it has a validate method
        if (extension.validate) {
          const validation = extension.validate(phaseContext);
          if (validation !== true) {
            const errorMsg = typeof validation === 'string' ? validation : `Extension "${extensionName}" validation failed`;
            if (this.continueOnError) {
              console.warn(`[${extensionName}] ${errorMsg}, skipping`);
              continue;
            } else {
              throw new Error(errorMsg);
            }
          }
        }

        // Execute appropriate hook
        let result: ExtensionTransformResult | void | undefined;
        
        switch (phase) {
          case GenerationPhase.INITIALIZATION:
            result = await extension.onInitialization?.(phaseContext);
            break;
          case GenerationPhase.BEFORE_DISCOVERY:
            result = await extension.beforeDiscovery?.(phaseContext);
            break;
          case GenerationPhase.AFTER_DISCOVERY:
            result = await extension.afterDiscovery?.(phaseContext);
            break;
          case GenerationPhase.BEFORE_GENERATION:
            result = await extension.beforeGeneration?.(phaseContext);
            break;
          case GenerationPhase.AFTER_GENERATION:
            if (finalSchemaSDL !== undefined) {
              const hookResult = await extension.afterGeneration?.(phaseContext, finalSchemaSDL);
              if (typeof hookResult === 'string') {
                finalSchemaSDL = hookResult;
              }
            }
            continue; // afterGeneration doesn't return ExtensionTransformResult
        }

        // Apply transformations from result
        if (result && typeof result === 'object' && 'config' in result) {
          // Merge config changes
          if (result.config) {
            config = { ...config, ...result.config };
          }

          // Register additional types
          if (result.additionalTypes) {
            for (const { name, schema } of result.additionalTypes) {
              Registry.set(schema, name);
            }
          }
        }
      } catch (error) {
        if (this.continueOnError) {
          console.error(`[${extensionName}] Error in ${phase} phase:`, error);
        } else {
          throw error;
        }
      }
    }

    return { config, schemaSDL: finalSchemaSDL };
  }

  /**
   * Run initialization phase
   */
  async initialize(context: ExtensionContext): Promise<void> {
    await this.executePhase(GenerationPhase.INITIALIZATION, context);
  }

  /**
   * Run before discovery phase
   */
  async beforeDiscovery(context: ExtensionContext): Promise<GeneratorConfig> {
    const result = await this.executePhase(GenerationPhase.BEFORE_DISCOVERY, context);
    return result.config;
  }

  /**
   * Run after discovery phase
   */
  async afterDiscovery(context: ExtensionContext): Promise<GeneratorConfig> {
    const result = await this.executePhase(GenerationPhase.AFTER_DISCOVERY, context);
    return result.config;
  }

  /**
   * Run before generation phase
   */
  async beforeGeneration(context: ExtensionContext): Promise<GeneratorConfig> {
    const result = await this.executePhase(GenerationPhase.BEFORE_GENERATION, context);
    return result.config;
  }

  /**
   * Run after generation phase
   */
  async afterGeneration(context: ExtensionContext, schemaSDL: string): Promise<string> {
    const result = await this.executePhase(GenerationPhase.AFTER_GENERATION, context, schemaSDL);
    return result.schemaSDL || schemaSDL;
  }

  /**
   * Get all registered extensions
   */
  getExtensions(): SchemaExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get extension by name
   */
  getExtension(name: string): SchemaExtension | undefined {
    return this.extensions.get(name);
  }

  /**
   * Clear all extensions
   */
  clear(): void {
    this.extensions.clear();
    this.executionOrder = [];
  }
}

