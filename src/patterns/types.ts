import { z } from 'zod';
import { RelationshipDefinition } from '../../zodql/relationships.js';
import { GeneratorConfig } from '../../generators/GraphQLSchemaGenerator.js';

/**
 * =================================================================================
 * Relationship Pattern Types
 * =================================================================================
 *
 * Defines the interface for relationship patterns that transform schemas
 * to implement different GraphQL relationship patterns.
 */

/**
 * Context provided to patterns during transformation
 */
export interface PatternContext {
  /** The relationship being processed */
  relationship: RelationshipDefinition;
  
  /** The generator configuration */
  config: GeneratorConfig;
  
  /** The entity name */
  entityName: string;
  
  /** Registry for type lookups */
  registry: typeof import('../../zodql/registry.js').Registry;
  
  /** Additional context data */
  [key: string]: any;
}

/**
 * Result of applying a pattern transformation
 */
export interface PatternResult {
  /** Modified source type schema (with relationship field added) */
  sourceType?: z.ZodObject<any>;
  
  /** Modified target type schema (with back-reference field added) */
  targetType?: z.ZodObject<any>;
  
  /** Additional types to register (e.g., Connection, Edge types) */
  additionalTypes?: Array<{
    name: string;
    schema: z.ZodTypeAny;
  }>;
  
  /** Additional query operations to add */
  queryOperations?: Record<string, z.ZodFunction<any, any>>;
  
  /** Additional mutation operations to add */
  mutationOperations?: Record<string, z.ZodFunction<any, any>>;
  
  /** Metadata about what was generated */
  metadata?: Record<string, any>;
}

/**
 * Interface that all relationship patterns must implement
 */
export interface RelationshipPattern {
  /** Unique name for this pattern */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** Whether this pattern supports the given relationship type */
  supports(relationshipType: string): boolean;
  
  /**
   * Apply this pattern to transform the schema
   * 
   * @param context Pattern context with relationship and config
   * @returns Pattern result with transformed schemas
   */
  apply(context: PatternContext): PatternResult;
  
  /**
   * Optional: Validate that this pattern can be applied
   */
  validate?(context: PatternContext): boolean | string;
}

