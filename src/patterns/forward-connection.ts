import { z } from 'zod';
import { register } from '../zodql/registry.js';
import { defineObject } from '../zodql/index.js';
import { Scalars } from '../zodql/scalars.js';
import { field } from '../zodql/fields.js';
import type { RelationshipPattern, PatternContext, PatternResult } from './types.js';

/**
 * =================================================================================
 * Forward Connection Pattern
 * =================================================================================
 *
 * Implements Relay-style forward connections:
 * - Adds connection field on source type (e.g., Project.dashboards)
 * - Adds back-reference on target type (e.g., Dashboard.project)
 * - Creates Connection and Edge types
 * - Supports pagination arguments
 */

/**
 * Forward Connection Pattern implementation
 */
export class ForwardConnectionPattern implements RelationshipPattern {
  name = 'forward-connection';
  description = 'Relay-style forward connection with pagination support';

  supports(relationshipType: string): boolean {
    // Pattern is relationship-type agnostic - works for all types
    // The pattern's behavior is based on its purpose, not relationship type
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
      metadata: {
        pattern: this.name,
        fieldName: options.fieldName,
        backReferenceFieldName: options.backReferenceFieldName,
      },
    };

    // Create Connection type (e.g., DashboardConnection)
    const connectionTypeName = `${targetTypeName}Connection`;
    const edgeTypeName = `${targetTypeName}Edge`;
    const pageInfoTypeName = 'PageInfo';

    // Check if PageInfo already exists and get/create it
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

    // Create Edge type (e.g., DashboardEdge)
    const edgeType = this.createEdgeType(edgeTypeName, targetType);
    result.additionalTypes!.push({
      name: edgeTypeName,
      schema: edgeType,
    });

    // Create Connection type (e.g., DashboardConnection)
    // Use the actual registered types so dependencies are discovered
    const connectionType = this.createConnectionType(
      connectionTypeName,
      edgeType,
      pageInfo,
      options.includeCount
    );
    result.additionalTypes!.push({
      name: connectionTypeName,
      schema: connectionType,
    });

    // Add connection field to source type with pagination arguments
    const connectionField = this.createConnectionField(connectionTypeName);
    const sourceShape = sourceType.shape;
    
    // Merge existing fields with new connection field
    const newFields: Record<string, z.ZodTypeAny> = {
      ...sourceShape,
      [options.fieldName]: connectionField,
    };
    
    if (options.includeCount) {
      newFields[`${options.fieldName}Count`] = Scalars.Int;
    }
    
    result.sourceType = register(sourceTypeName, z.object(newFields));

    // Add back-reference to target type
    const targetShape = targetType.shape;
    result.targetType = register(
      targetTypeName,
      z.object({
        ...targetShape,
        [options.backReferenceFieldName]: sourceType,
      })
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

  /**
   * Create connection field with pagination arguments
   * Uses field() helper to create a function type with arguments
   */
  private createConnectionField(connectionTypeName: string): z.ZodFunction<any, any> {
    // The connection type will be registered by the pattern manager
    // We use z.any() here and the generator will resolve it via Registry
    const connectionType = z.any();
    
    // Register a temporary schema so the generator can resolve the type name
    // This will be replaced when the actual connection type is registered
    register(connectionTypeName, connectionType);
    
    // Create field with pagination arguments: dashboards(first: Int, after: String): DashboardConnection!
    return field(
      {
        first: Scalars.Int.optional(),
        after: Scalars.String.optional(),
      },
      connectionType
    );
  }
}

/**
 * Default instance of forward connection pattern
 */
export const forwardConnectionPattern = new ForwardConnectionPattern();

