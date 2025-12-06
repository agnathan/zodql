import { z } from 'zod';
import { RelationshipRegistry, RelationshipDefinition } from '../zodql/relationships.js';
import { Registry } from '../zodql/registry.js';
import type { RelationshipPattern, PatternContext, PatternResult } from './types.js';
import type { GeneratorConfig } from '../generators/GraphQLSchemaGenerator.js';
import { PatternNames, type PatternName } from './constants.js';
import { forwardConnectionPattern } from './forward-connection.js';
import { rootLevelFilterPattern } from './root-level-filter.js';
import { backReferenceOnlyPattern } from './back-reference-only.js';

/**
 * =================================================================================
 * Pattern Manager
 * =================================================================================
 *
 * Manages relationship patterns and applies them to transform schemas.
 */

export interface PatternManagerOptions {
  /** Default pattern to use when relationship doesn't specify one */
  defaultPattern?: PatternName | string;
  
  /** Map of pattern names to pattern instances */
  patterns?: Map<PatternName | string, RelationshipPattern>;
  
  /** Whether to throw on errors or continue */
  continueOnError?: boolean;
}

/**
 * Type-safe pattern manager builder
 */
export class PatternManagerBuilder {
  private defaultPattern?: PatternName | string;
  private patterns = new Map<PatternName | string, RelationshipPattern>();
  private continueOnError = true;

  /**
   * Set the default pattern
   */
  withDefaultPattern(pattern: PatternName): this {
    this.defaultPattern = pattern;
    return this;
  }

  /**
   * Register a pattern
   */
  withPattern(name: PatternName, pattern: RelationshipPattern): this {
    this.patterns.set(name, pattern);
    return this;
  }

  /**
   * Register all built-in patterns
   */
  withBuiltInPatterns(): this {
    this.patterns.set(PatternNames.ForwardConnection, forwardConnectionPattern);
    this.patterns.set(PatternNames.RootLevelFilter, rootLevelFilterPattern);
    this.patterns.set(PatternNames.BackReferenceOnly, backReferenceOnlyPattern);
    return this;
  }

  /**
   * Set error handling behavior
   */
  withErrorHandling(continueOnError: boolean): this {
    this.continueOnError = continueOnError;
    return this;
  }

  /**
   * Build the pattern manager
   */
  build(): PatternManager {
    return new PatternManager({
      defaultPattern: this.defaultPattern,
      patterns: this.patterns,
      continueOnError: this.continueOnError,
    });
  }
}

/**
 * Create a type-safe pattern manager builder
 * 
 * @example
 * ```typescript
 * const patternManager = createPatternManager()
 *   .withDefaultPattern(PatternNames.ForwardConnection)
 *   .withBuiltInPatterns()
 *   .build();
 * ```
 */
export function createPatternManager(): PatternManagerBuilder {
  return new PatternManagerBuilder();
}

/**
 * Manages and applies relationship patterns
 */
export class PatternManager {
  private patterns = new Map<string, RelationshipPattern>();
  private defaultPatternName: string;
  private continueOnError: boolean;

  constructor(options: PatternManagerOptions = {}) {
    this.defaultPatternName = options.defaultPattern || 'back-reference-only';
    this.continueOnError = options.continueOnError ?? true; // Default to true
    
    if (options.patterns) {
      for (const [name, pattern] of options.patterns) {
        this.registerPattern(name, pattern);
      }
    }
  }

  /**
   * Register a pattern
   */
  registerPattern(name: string, pattern: RelationshipPattern): void {
    this.patterns.set(name, pattern);
  }

  /**
   * Register multiple patterns
   */
  registerPatterns(patterns: Map<string, RelationshipPattern>): void {
    for (const [name, pattern] of patterns) {
      this.registerPattern(name, pattern);
    }
  }

  /**
   * Get a pattern by name
   */
  getPattern(name: string): RelationshipPattern | undefined {
    return this.patterns.get(name);
  }

  /**
   * Apply all registered patterns to relationships
   */
  applyPatterns(
    config: GeneratorConfig,
    entityName: string,
    continueOnError?: boolean
  ): {
    modifiedConfig: GeneratorConfig;
    patternResults: Map<string, PatternResult>;
  } {
    // Use instance's continueOnError if not provided
    const shouldContinueOnError = continueOnError ?? this.continueOnError;
    const relationships = RelationshipRegistry.getAll();
    const patternResults = new Map<string, PatternResult>();
    const modifiedConfig: GeneratorConfig = {
      ...config,
      queries: config.queries ? { ...config.queries } : undefined,
      mutations: config.mutations ? { ...config.mutations } : undefined,
    };

    // Track modified types
    const modifiedTypes = new Map<string, z.ZodObject<any>>();

    for (const relationship of relationships) {
      if (relationship.processed) continue;

      const patternName = relationship.options.pattern || this.defaultPatternName;
      const pattern = this.patterns.get(patternName);

      if (!pattern) {
        if (shouldContinueOnError) {
          console.warn(`Pattern "${patternName}" not found for relationship ${relationship.id}, skipping`);
          continue;
        } else {
          throw new Error(`Pattern "${patternName}" not found for relationship ${relationship.id}`);
        }
      }

      // Validate pattern
      const context: PatternContext = {
        relationship,
        config: modifiedConfig,
        entityName,
        registry: Registry,
      };

      const validation = pattern.validate?.(context);
      if (validation !== true) {
        if (shouldContinueOnError) {
          console.warn(`Pattern validation failed for relationship ${relationship.id}: ${validation}`);
          continue;
        } else {
          throw new Error(`Pattern validation failed for relationship ${relationship.id}: ${validation}`);
        }
      }

      // Note: Pattern supports() check is now optional since patterns are relationship-type agnostic
      // Keeping it for backward compatibility, but patterns should return true for all types
      if (!pattern.supports(relationship.relationshipType)) {
        const errorMsg = `Pattern "${patternName}" does not support relationship type "${relationship.relationshipType}"`;
        if (shouldContinueOnError) {
          console.warn(`${errorMsg} for ${relationship.id}`);
          continue;
        } else {
          throw new Error(errorMsg);
        }
      }

      // Apply pattern
      try {
        const result = pattern.apply(context);
        patternResults.set(relationship.id, result);

        // Apply transformations to config
        // Merge modifications if the type was already modified by another relationship
        if (result.sourceType) {
          if (modifiedTypes.has(relationship.sourceTypeName)) {
            // Merge with existing modification
            const existingSchema = modifiedTypes.get(relationship.sourceTypeName)!;
            if (existingSchema instanceof z.ZodObject && result.sourceType instanceof z.ZodObject) {
              const mergedSchema = z.object({
                ...existingSchema.shape,
                ...result.sourceType.shape, // Later modifications overwrite earlier ones
              });
              Registry.set(mergedSchema, relationship.sourceTypeName);
              modifiedTypes.set(relationship.sourceTypeName, mergedSchema);
            } else {
              modifiedTypes.set(relationship.sourceTypeName, result.sourceType);
            }
          } else {
            modifiedTypes.set(relationship.sourceTypeName, result.sourceType);
          }
        }

        if (result.targetType) {
          if (modifiedTypes.has(relationship.targetTypeName)) {
            // Merge with existing modification
            const existingSchema = modifiedTypes.get(relationship.targetTypeName)!;
            if (existingSchema instanceof z.ZodObject && result.targetType instanceof z.ZodObject) {
              const mergedSchema = z.object({
                ...existingSchema.shape,
                ...result.targetType.shape, // Later modifications overwrite earlier ones
              });
              Registry.set(mergedSchema, relationship.targetTypeName);
              modifiedTypes.set(relationship.targetTypeName, mergedSchema);
            } else {
              modifiedTypes.set(relationship.targetTypeName, result.targetType);
            }
          } else {
            modifiedTypes.set(relationship.targetTypeName, result.targetType);
          }
        }

        // Register additional types FIRST (before modifying source/target types)
        // This ensures connection types are available when referenced in fields
        if (result.additionalTypes) {
          for (const { name, schema } of result.additionalTypes) {
            Registry.set(schema, name);
            // If it's a connection type, add to connections
            if (name.endsWith('Connection')) {
              if (!modifiedConfig.connections) {
                modifiedConfig.connections = {};
              }
              modifiedConfig.connections[name] = schema;
            }
          }
        }

        // Add query operations
        if (result.queryOperations) {
          if (!modifiedConfig.queries) {
            modifiedConfig.queries = {};
          }
          Object.assign(modifiedConfig.queries, result.queryOperations);
        }

        // Add mutation operations
        if (result.mutationOperations) {
          if (!modifiedConfig.mutations) {
            modifiedConfig.mutations = {};
          }
          Object.assign(modifiedConfig.mutations, result.mutationOperations);
        }

        // Mark relationship as processed
        RelationshipRegistry.markProcessed(relationship.id);
      } catch (error) {
        if (shouldContinueOnError) {
          console.error(`Error applying pattern "${patternName}" to relationship ${relationship.id}:`, error);
        } else {
          throw error;
        }
      }
    }

    // Update config schema if it was modified
    if (modifiedTypes.has(entityName)) {
      modifiedConfig.schema = modifiedTypes.get(entityName)!;
    }

    return {
      modifiedConfig,
      patternResults,
    };
  }

  /**
   * Clear all registered patterns
   */
  clear(): void {
    this.patterns.clear();
  }
}

