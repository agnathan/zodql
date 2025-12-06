import { z } from 'zod';
import { register } from '../zodql/registry.js';
import { defineObject } from '../zodql/index.js';
import { Scalars } from '../zodql/scalars.js';
import { field } from '../zodql/fields.js';
import type { RelationshipPattern, PatternContext, PatternResult } from './types.js';

/**
 * =================================================================================
 * Root-Level Filter Pattern
 * =================================================================================
 *
 * Implements root-level filtered queries:
 * - No connection field on source type
 * - Adds root-level query with filter argument
 * - Adds back-reference and ID field on target type
 * - Creates Connection and Edge types
 */

/**
 * Root-Level Filter Pattern implementation
 */
export class RootLevelFilterPattern implements RelationshipPattern {
  name = 'root-level-filter';
  description = 'Root-level filtered queries with mandatory filter arguments';

  supports(relationshipType: string): boolean {
    // Pattern is relationship-type agnostic - works for all types
    return true;
  }

  validate(context: PatternContext): boolean | string {
    // No validation needed - pattern works for all relationship types
    return true;
  }

  apply(context: PatternContext): PatternResult {
    const { relationship, registry } = context;
    const {
      sourceType,
      targetType,
      sourceTypeName,
      targetTypeName,
      options,
    } = relationship;

    const result: PatternResult = {
      additionalTypes: [],
      queryOperations: {},
      metadata: {
        pattern: this.name,
        backReferenceFieldName: options.backReferenceFieldName,
      },
    };

    // Create Connection type (e.g., DashboardConnection)
    const connectionTypeName = `${targetTypeName}Connection`;
    const edgeTypeName = `${targetTypeName}Edge`;
    const pageInfoTypeName = 'PageInfo';

    // Get or create PageInfo type
    let pageInfo: z.ZodObject<any>;
    let pageInfoExists = false;
    for (const [schema, name] of registry.entries()) {
      if (name === pageInfoTypeName && schema instanceof z.ZodObject) {
        pageInfo = schema;
        pageInfoExists = true;
        break;
      }
    }
    
    if (!pageInfoExists) {
      pageInfo = this.createPageInfoType(pageInfoTypeName);
      result.additionalTypes!.push({
        name: pageInfoTypeName,
        schema: pageInfo,
      });
    }

    // Create Edge type
    const edgeType = this.createEdgeType(edgeTypeName, targetType);
    result.additionalTypes!.push({
      name: edgeTypeName,
      schema: edgeType,
    });

    // Create Connection type using actual Edge and PageInfo types
    const connectionType = this.createConnectionType(
      connectionTypeName,
      edgeType,
      pageInfo!,
      options.includeCount
    );
    result.additionalTypes!.push({
      name: connectionTypeName,
      schema: connectionType,
    });

    // Add optional count field to source type (no connection field)
    if (options.includeCount) {
      const sourceShape = sourceType.shape;
      result.sourceType = register(
        sourceTypeName,
        z.object({
          ...sourceShape,
          [`${options.fieldName}Count`]: Scalars.Int.optional(),
        })
      );
    }

    // Add back-reference and source ID to target type
    const targetShape = targetType.shape;
    const newTargetFields: Record<string, z.ZodTypeAny> = {
      ...targetShape,
      [options.backReferenceFieldName]: sourceType,
    };

    // Add source ID field for client caching (e.g., projectId)
    const sourceIdFieldName = `${options.backReferenceFieldName}Id`;
    if (!targetShape[sourceIdFieldName]) {
      newTargetFields[sourceIdFieldName] = Scalars.ID;
    }

    result.targetType = register(targetTypeName, z.object(newTargetFields));

    // Create root-level query operation
    const queryName = options.fieldName; // e.g., 'dashboards'
    const connectionTypeSchema = z.any();
    
    // Register temporary schema so generator can resolve type name
    register(connectionTypeName, connectionTypeSchema);
    
    result.queryOperations![queryName] = field(
      {
        [`${options.backReferenceFieldName}Id`]: Scalars.ID, // Required filter
        first: Scalars.Int.optional(),
        after: Scalars.String.optional(),
      },
      connectionTypeSchema
    );

    return result;
  }

  /**
   * Create PageInfo type
   */
  private createPageInfoType(name: string): z.ZodObject<any> {
    return defineObject(name, {
      fields: {
        hasNextPage: Scalars.Boolean,
        hasPreviousPage: Scalars.Boolean,
        startCursor: Scalars.String.nullable(),
        endCursor: Scalars.String.nullable(),
      },
    });
  }

  /**
   * Create PageInfo schema for registry lookup
   */
  private createPageInfoSchema(): z.ZodObject<any> {
    return z.object({
      hasNextPage: Scalars.Boolean,
      hasPreviousPage: Scalars.Boolean,
      startCursor: Scalars.String.nullable(),
      endCursor: Scalars.String.nullable(),
    });
  }

  /**
   * Create Edge type
   */
  private createEdgeType(name: string, nodeType: z.ZodObject<any>): z.ZodObject<any> {
    return defineObject(name, {
      fields: {
        cursor: Scalars.String,
        node: nodeType,
      },
    });
  }

  /**
   * Create Connection type
   */
  private createConnectionType(
    name: string,
    edgeType: z.ZodTypeAny,
    pageInfoType: z.ZodTypeAny,
    includeTotalCount: boolean
  ): z.ZodObject<any> {
    const fields: Record<string, z.ZodTypeAny> = {
      edges: z.array(edgeType),
      pageInfo: pageInfoType,
    };

    if (includeTotalCount) {
      fields.totalCount = Scalars.Int.nullable();
    }

    return defineObject(name, { fields });
  }
}

/**
 * Default instance of root-level filter pattern
 */
export const rootLevelFilterPattern = new RootLevelFilterPattern();

