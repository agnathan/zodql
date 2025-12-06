import { z } from 'zod';
import { register } from '../zodql/registry.js';
import { Scalars } from '../zodql/scalars.js';
import type { RelationshipPattern, PatternContext, PatternResult } from './types.js';
import { isSourceManySide } from './cardinality.js';

/**
 * =================================================================================
 * Back-Reference Only Pattern
 * =================================================================================
 *
 * Simple pattern that only adds back-reference:
 * - No connection field on source type
 * - Adds back-reference based on cardinality (on the "many" side)
 * - No additional types or operations
 */

/**
 * Back-Reference Only Pattern implementation
 */
export class BackReferenceOnlyPattern implements RelationshipPattern {
  name = 'back-reference-only';
  description = 'Simple back-reference without connection fields';

  supports(relationshipType: string): boolean {
    return true; // Supports all relationship types
  }

  validate(context: PatternContext): boolean | string {
    return true;
  }

  apply(context: PatternContext): PatternResult {
    const { relationship } = context;
    const {
      sourceType,
      targetType,
      sourceTypeName,
      targetTypeName,
      relationshipType,
      options,
    } = relationship;

    const result: PatternResult = {
      metadata: {
        pattern: this.name,
        backReferenceFieldName: options.backReferenceFieldName,
      },
    };

    // Pattern logic: Back-reference goes on the "many" side
    // This is based on cardinality, not relationship type name
    if (isSourceManySide(relationshipType)) {
      // Source is "many" side → add back-reference to source
      // Example: Project BelongsTo User → Project.owner: User!
      const sourceShape = sourceType.shape;
      result.sourceType = register(
        sourceTypeName,
        z.object({
          ...sourceShape,
          [options.backReferenceFieldName]: targetType,
        })
      );
    } else {
      // Target is "many" side → add back-reference to target
      // Example: Project HasMany Dashboard → Dashboard.project: Project!
      const targetShape = targetType.shape;
      result.targetType = register(
        targetTypeName,
        z.object({
          ...targetShape,
          [options.backReferenceFieldName]: sourceType,
        })
      );
    }

    return result;
  }
}

/**
 * Default instance of back-reference-only pattern
 */
export const backReferenceOnlyPattern = new BackReferenceOnlyPattern();

