import { z } from 'zod';
import { Registry } from './registry.js';

/**
 * =================================================================================
 * Relationship Types and Registry
 * =================================================================================
 *
 * Defines relationships between ZodQL types and provides API for
 * relationship definition and management.
 */

/**
 * Types of relationships between entities
 */
export type RelationshipType = 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

/**
 * Relationship type constants for type-safe usage
 */
export const RelationshipTypes = {
  HasOne: 'hasOne',
  HasMany: 'hasMany',
  BelongsTo: 'belongsTo',
  BelongsToMany: 'belongsToMany',
} as const;

/**
 * Options for defining a relationship
 */
export interface RelationshipOptions {
  /** Pattern to use for this relationship (e.g., 'forward-connection', 'root-level-filter') */
  pattern?: string;
  
  /** Field name on the source type (e.g., 'dashboards' on Project) */
  fieldName?: string;
  
  /** Field name on the target type for back-reference (e.g., 'project' on Dashboard) */
  backReferenceFieldName?: string;
  
  /** Whether to include count fields */
  includeCount?: boolean;
  
  /** Custom metadata for the relationship */
  metadata?: Record<string, any>;
  
  /** Additional pattern-specific options */
  patternOptions?: Record<string, any>;
}

/**
 * Represents a relationship between two types
 */
export interface RelationshipDefinition {
  /** Unique ID for this relationship */
  id: string;
  
  /** Source type (the type that "owns" the relationship) */
  sourceType: z.ZodObject<any>;
  
  /** Source type name */
  sourceTypeName: string;
  
  /** Target type (the related type) */
  targetType: z.ZodObject<any>;
  
  /** Target type name */
  targetTypeName: string;
  
  /** Type of relationship */
  relationshipType: RelationshipType;
  
  /** Options for this relationship */
  options: Required<RelationshipOptions>;
  
  /** Whether this relationship has been processed by patterns */
  processed: boolean;
}

/**
 * Global registry of relationships
 */
class RelationshipRegistryClass {
  private relationships = new Map<string, RelationshipDefinition>();
  private relationshipsBySource = new Map<string, RelationshipDefinition[]>();
  private relationshipsByTarget = new Map<string, RelationshipDefinition[]>();
  private nextId = 1;

  /**
   * Register a new relationship
   */
  register(
    sourceType: z.ZodObject<any>,
    relationshipType: RelationshipType,
    targetType: z.ZodObject<any>,
    options: RelationshipOptions = {}
  ): RelationshipDefinition {
    const sourceTypeName = this.getTypeName(sourceType);
    const targetTypeName = this.getTypeName(targetType);
    
    if (!sourceTypeName || !targetTypeName) {
      throw new Error('Both source and target types must be registered in the Registry');
    }

    const id = `rel_${this.nextId++}`;
    const defaultFieldName = this.getDefaultFieldName(relationshipType, targetTypeName);
    const defaultBackRefName = this.getDefaultBackRefName(sourceTypeName);

    const definition: RelationshipDefinition = {
      id,
      sourceType,
      sourceTypeName,
      targetType,
      targetTypeName,
      relationshipType,
      options: {
        pattern: options.pattern, // Don't default to 'default' - let PatternManager handle it
        fieldName: options.fieldName || defaultFieldName,
        backReferenceFieldName: options.backReferenceFieldName || defaultBackRefName,
        includeCount: options.includeCount ?? false,
        metadata: options.metadata || {},
        patternOptions: options.patternOptions || {},
      },
      processed: false,
    };

    this.relationships.set(id, definition);
    
    // Index by source
    if (!this.relationshipsBySource.has(sourceTypeName)) {
      this.relationshipsBySource.set(sourceTypeName, []);
    }
    this.relationshipsBySource.get(sourceTypeName)!.push(definition);
    
    // Index by target
    if (!this.relationshipsByTarget.has(targetTypeName)) {
      this.relationshipsByTarget.set(targetTypeName, []);
    }
    this.relationshipsByTarget.get(targetTypeName)!.push(definition);

    return definition;
  }

  /**
   * Get all relationships
   */
  getAll(): RelationshipDefinition[] {
    return Array.from(this.relationships.values());
  }

  /**
   * Get relationships by source type
   */
  getBySource(sourceTypeName: string): RelationshipDefinition[] {
    return this.relationshipsBySource.get(sourceTypeName) || [];
  }

  /**
   * Get relationships by target type
   */
  getByTarget(targetTypeName: string): RelationshipDefinition[] {
    return this.relationshipsByTarget.get(targetTypeName) || [];
  }

  /**
   * Get a relationship by ID
   */
  getById(id: string): RelationshipDefinition | undefined {
    return this.relationships.get(id);
  }

  /**
   * Clear all relationships
   */
  clear(): void {
    this.relationships.clear();
    this.relationshipsBySource.clear();
    this.relationshipsByTarget.clear();
    this.nextId = 1;
  }

  /**
   * Mark a relationship as processed
   */
  markProcessed(id: string): void {
    const rel = this.relationships.get(id);
    if (rel) {
      rel.processed = true;
    }
  }

  /**
   * Get type name from Zod schema
   */
  private getTypeName(schema: z.ZodTypeAny): string | undefined {
    return Registry.get(schema);
  }

  /**
   * Get default field name based on relationship type
   */
  private getDefaultFieldName(relationshipType: RelationshipType, targetTypeName: string): string {
    switch (relationshipType) {
      case 'hasMany':
      case 'belongsToMany':
        // Pluralize: Dashboard -> dashboards
        return this.pluralize(this.camelCase(targetTypeName));
      case 'hasOne':
      case 'belongsTo':
        // Singular: Project -> project
        return this.camelCase(targetTypeName);
      default:
        return this.camelCase(targetTypeName);
    }
  }

  /**
   * Get default back-reference field name
   */
  private getDefaultBackRefName(sourceTypeName: string): string {
    return this.camelCase(sourceTypeName);
  }

  /**
   * Convert PascalCase to camelCase
   */
  private camelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Simple pluralization (basic implementation)
   */
  private pluralize(str: string): string {
    if (str.endsWith('y')) {
      return str.slice(0, -1) + 'ies';
    }
    if (str.endsWith('s') || str.endsWith('x') || str.endsWith('z') || str.endsWith('ch') || str.endsWith('sh')) {
      return str + 'es';
    }
    return str + 's';
  }
}

/**
 * Global relationship registry instance
 */
export const RelationshipRegistry = new RelationshipRegistryClass();

/**
 * Type-safe relationship builder
 */
export class RelationshipBuilder {
  private sourceType: z.ZodObject<any>;
  private relationshipType: RelationshipType;
  private targetType: z.ZodObject<any>;
  private options: RelationshipOptions = {};

  constructor(
    sourceType: z.ZodObject<any>,
    relationshipType: RelationshipType,
    targetType: z.ZodObject<any>
  ) {
    this.sourceType = sourceType;
    this.relationshipType = relationshipType;
    this.targetType = targetType;
  }

  /**
   * Set the pattern to use
   */
  withPattern(pattern: string): this {
    this.options.pattern = pattern;
    return this;
  }

  /**
   * Set the field name on the source type
   */
  withFieldName(fieldName: string): this {
    this.options.fieldName = fieldName;
    return this;
  }

  /**
   * Set the back-reference field name on the target type
   */
  withBackReferenceFieldName(backReferenceFieldName: string): this {
    this.options.backReferenceFieldName = backReferenceFieldName;
    return this;
  }

  /**
   * Enable count fields
   */
  withCount(): this {
    this.options.includeCount = true;
    return this;
  }

  /**
   * Set custom metadata
   */
  withMetadata(metadata: Record<string, any>): this {
    this.options.metadata = metadata;
    return this;
  }

  /**
   * Set pattern-specific options
   */
  withPatternOptions(patternOptions: Record<string, any>): this {
    this.options.patternOptions = patternOptions;
    return this;
  }

  /**
   * Build and register the relationship
   */
  build(): RelationshipDefinition {
    return RelationshipRegistry.register(
      this.sourceType,
      this.relationshipType,
      this.targetType,
      this.options
    );
  }
}

/**
 * Define a relationship between two types
 * 
 * @example
 * ```typescript
 * const Project = defineObject('Project', { ... });
 * const Dashboard = defineObject('Dashboard', { ... });
 * 
 * defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
 *   pattern: PatternNames.ForwardConnection,
 *   fieldName: 'dashboards'
 * });
 * ```
 */
export function defineRelationship(
  sourceType: z.ZodObject<any>,
  relationshipType: RelationshipType,
  targetType: z.ZodObject<any>,
  options: RelationshipOptions = {}
): RelationshipDefinition {
  return RelationshipRegistry.register(sourceType, relationshipType, targetType, options);
}

/**
 * Create a type-safe relationship builder
 * 
 * @example
 * ```typescript
 * relationship(Project, RelationshipTypes.HasMany, Dashboard)
 *   .withPattern(PatternNames.ForwardConnection)
 *   .withFieldName('dashboards')
 *   .withCount()
 *   .build();
 * ```
 */
export function relationship(
  sourceType: z.ZodObject<any>,
  relationshipType: RelationshipType,
  targetType: z.ZodObject<any>
): RelationshipBuilder {
  return new RelationshipBuilder(sourceType, relationshipType, targetType);
}
