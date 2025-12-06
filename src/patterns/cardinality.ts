import type { RelationshipType } from '../zodql/relationships.js';

/**
 * =================================================================================
 * Cardinality Inference Utilities
 * =================================================================================
 *
 * Converts relationship types to cardinality information for pattern logic.
 * This decouples patterns from relationship type names.
 */

export type Cardinality = 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';

/**
 * Infer cardinality from relationship type
 * 
 * @param relationshipType The relationship type (hasMany, belongsTo, etc.)
 * @returns The cardinality of the relationship
 */
export function inferCardinality(relationshipType: RelationshipType | string): Cardinality {
  switch (relationshipType) {
    case 'hasMany':
    case 'belongsToMany':
      return 'one-to-many'; // Source is "one", target is "many"
    case 'belongsTo':
      return 'many-to-one'; // Source is "many", target is "one"
    case 'hasOne':
      return 'one-to-one';
    default:
      return 'one-to-many'; // Safe default
  }
}

/**
 * Check if source is the "many" side of the relationship
 */
export function isSourceManySide(relationshipType: RelationshipType | string): boolean {
  const cardinality = inferCardinality(relationshipType);
  return cardinality === 'many-to-one' || cardinality === 'many-to-many';
}

/**
 * Check if target is the "many" side of the relationship
 */
export function isTargetManySide(relationshipType: RelationshipType | string): boolean {
  const cardinality = inferCardinality(relationshipType);
  return cardinality === 'one-to-many' || cardinality === 'many-to-many';
}

