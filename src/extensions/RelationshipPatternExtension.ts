import { z } from 'zod';
import type { SchemaExtension, ExtensionContext, ExtensionTransformResult } from './types.js';
import { GenerationPhase } from './types.js';
import type { RelationshipPattern, PatternContext, PatternResult } from '../patterns/types.js';
import type { RelationshipDefinition, RelationshipType } from '../zodql/relationships.js';
import { RelationshipRegistry } from '../zodql/relationships.js';
import { Registry } from '../zodql/registry.js';
import { register } from '../zodql/registry.js';
import { PatternNames, type PatternName } from '../patterns/constants.js';
import { inferCardinality } from '../patterns/cardinality.js';

/**
 * =================================================================================
 * Relationship Pattern Extension
 * =================================================================================
 *
 * Extension that applies relationship patterns to transform schemas.
 * This replaces the direct PatternManager integration in GraphQLSchemaGenerator.
 */

export interface RelationshipPatternExtensionOptions {
  /** Default pattern to use when relationship doesn't specify one */
  defaultPattern?: PatternName | string;
  
  /** Map of pattern names to pattern implementations */
  patterns?: Map<PatternName | string, RelationshipPattern>;
  
  /** Whether to continue on errors */
  continueOnError?: boolean;
  
  /** Relationships to process (if not provided, discovers from RelationshipRegistry) */
  relationships?: RelationshipDefinition[];
}

/**
 * Extension that applies relationship patterns during schema generation
 */
export class RelationshipPatternExtension implements SchemaExtension {
  name = 'relationship-patterns';
  description = 'Applies relationship patterns to transform GraphQL schemas';
  
  private defaultPattern: string;
  private patterns: Map<string, RelationshipPattern>;
  private continueOnError: boolean;

  constructor(options: RelationshipPatternExtensionOptions = {}) {
    this.defaultPattern = options.defaultPattern || PatternNames.BackReferenceOnly;
    this.patterns = options.patterns || new Map();
    this.continueOnError = options.continueOnError ?? true;
  }

  /**
   * Register a pattern
   */
  registerPattern(name: string, pattern: RelationshipPattern): void {
    this.patterns.set(name, pattern);
  }

  /**
   * Validate extension can run
   */
  validate(context: ExtensionContext): boolean | string {
    // Check if we have any relationships to process
    const relationships = this.getRelationships(context);
    if (relationships.length === 0) {
      return true; // No relationships, nothing to do
    }

    // Check that all relationships have valid patterns
    for (const relationship of relationships) {
      const patternName = relationship.options.pattern || this.defaultPattern;
      if (!this.patterns.has(patternName)) {
        if (this.continueOnError) {
          return true; // Will skip with warning
        }
        return `Pattern "${patternName}" not found for relationship ${relationship.id}`;
      }
    }

    return true;
  }

  /**
   * Hook called before dependency discovery
   * This is where we apply patterns to transform the config
   */
  async beforeDiscovery(context: ExtensionContext): Promise<ExtensionTransformResult> {
    const relationships = this.getRelationships(context);
    if (relationships.length === 0) {
      return {}; // No relationships to process
    }

    const result: ExtensionTransformResult = {
      config: {
        ...context.config,
        queries: context.config.queries ? { ...context.config.queries } : undefined,
        mutations: context.config.mutations ? { ...context.config.mutations } : undefined,
        connections: context.config.connections ? { ...context.config.connections } : {},
      },
      additionalTypes: [],
    };

    const modifiedTypes = new Map<string, z.ZodObject<any>>();

    // Process each relationship
    for (const relationship of relationships) {
      if (relationship.processed) continue;

      const patternName = relationship.options.pattern || this.defaultPattern;
      const pattern = this.patterns.get(patternName);

      if (!pattern) {
        if (this.continueOnError) {
          console.warn(`Pattern "${patternName}" not found for relationship ${relationship.id}, skipping`);
          continue;
        } else {
          throw new Error(`Pattern "${patternName}" not found for relationship ${relationship.id}`);
        }
      }

      // Create pattern context
      const patternContext: PatternContext = {
        relationship,
        config: result.config!,
        entityName: context.entityName,
        registry: context.registry,
      };

      // Validate pattern
      if (pattern.validate) {
        const validation = pattern.validate(patternContext);
        if (validation !== true) {
          if (this.continueOnError) {
            console.warn(`Pattern validation failed for relationship ${relationship.id}: ${validation}`);
            continue;
          } else {
            throw new Error(`Pattern validation failed for relationship ${relationship.id}: ${validation}`);
          }
        }
      }

      try {
        // Apply pattern
        const patternResult = pattern.apply(patternContext);

        // Merge type modifications
        if (patternResult.sourceType) {
          this.mergeTypeModification(
            modifiedTypes,
            relationship.sourceTypeName,
            patternResult.sourceType,
            context.registry
          );
        }

        if (patternResult.targetType) {
          this.mergeTypeModification(
            modifiedTypes,
            relationship.targetTypeName,
            patternResult.targetType,
            context.registry
          );
        }

        // Collect additional types
        if (patternResult.additionalTypes) {
          for (const { name, schema } of patternResult.additionalTypes) {
            result.additionalTypes!.push({ name, schema });
            // Register immediately so other patterns can reference them
            context.registry.set(schema, name);
            
            // Add connection types to connections config
            if (name.endsWith('Connection')) {
              if (!result.config!.connections) {
                result.config!.connections = {};
              }
              result.config!.connections[name] = schema;
            }
          }
        }

        // Merge query operations
        if (patternResult.queryOperations) {
          if (!result.config!.queries) {
            result.config!.queries = {};
          }
          Object.assign(result.config!.queries, patternResult.queryOperations);
        }

        // Merge mutation operations
        if (patternResult.mutationOperations) {
          if (!result.config!.mutations) {
            result.config!.mutations = {};
          }
          Object.assign(result.config!.mutations, patternResult.mutationOperations);
        }

        // Mark relationship as processed
        RelationshipRegistry.markProcessed(relationship.id);
      } catch (error) {
        if (this.continueOnError) {
          console.error(`Error applying pattern "${patternName}" to relationship ${relationship.id}:`, error);
        } else {
          throw error;
        }
      }
    }

    // Update config schema if entity type was modified
    if (modifiedTypes.has(context.entityName)) {
      result.config!.schema = modifiedTypes.get(context.entityName)!;
    }

    return result;
  }

  /**
   * Merge type modifications, handling multiple patterns modifying the same type
   */
  private mergeTypeModification(
    modifiedTypes: Map<string, z.ZodObject<any>>,
    typeName: string,
    newSchema: z.ZodObject<any>,
    registry: typeof Registry
  ): void {
    if (modifiedTypes.has(typeName)) {
      // Merge with existing modification
      const existingSchema = modifiedTypes.get(typeName)!;
      const mergedSchema = z.object({
        ...existingSchema.shape,
        ...newSchema.shape, // Later modifications overwrite earlier ones
      });
      registry.set(mergedSchema, typeName);
      modifiedTypes.set(typeName, mergedSchema);
    } else {
      // First modification
      registry.set(newSchema, typeName);
      modifiedTypes.set(typeName, newSchema);
    }
  }

  /**
   * Get relationships to process
   */
  private getRelationships(context: ExtensionContext): RelationshipDefinition[] {
    // If relationships are provided in config, use those
    // Otherwise, discover from RelationshipRegistry
    // For now, we'll use RelationshipRegistry (backward compatibility)
    // TODO: Support explicit relationships in config
    return RelationshipRegistry.getAll().filter(rel => !rel.processed);
  }
}

