import { buildSchema, validateSchema, GraphQLError, GraphQLScalarType } from 'graphql';
import { buildASTSchema } from 'graphql';
import { parse } from 'graphql';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a GraphQL schema string for syntax and structural correctness
 * 
 * @param schemaSDL - The GraphQL Schema Definition Language string to validate
 * @returns ValidationResult with validation status, errors, and warnings
 * 
 * @example
 * ```typescript
 * const schema = `
 *   type User {
 *     id: ID!
 *     name: String!
 *   }
 * `;
 * 
 * const result = validateGraphQLSchema(schema);
 * if (!result.valid) {
 *   console.error('Schema validation failed:', result.errors);
 * }
 * ```
 */
export function validateGraphQLSchema(schemaSDL: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if AWS scalars are used but not defined
    const usesAWSDateTime = /AWSDateTime/.test(schemaSDL);
    const usesAWSJSON = /AWSJSON/.test(schemaSDL);
    const hasAWSDateTimeDef = /scalar AWSDateTime/.test(schemaSDL);
    const hasAWSJSONDef = /scalar AWSJSON/.test(schemaSDL);

    let schemaToParse = schemaSDL;
    if (usesAWSDateTime && !hasAWSDateTimeDef) {
      schemaToParse = 'scalar AWSDateTime\n\n' + schemaToParse;
    }
    if (usesAWSJSON && !hasAWSJSONDef) {
      schemaToParse = 'scalar AWSJSON\n\n' + schemaToParse;
    }

    // Step 1: Parse the schema SDL (catches syntax errors)
    let document;
    try {
      document = parse(schemaToParse);
    } catch (parseError: any) {
      if (parseError instanceof Error) {
        errors.push(`Syntax Error: ${parseError.message}`);
        if (parseError.locations) {
          parseError.locations.forEach((loc: any) => {
            errors.push(`  at line ${loc.line}, column ${loc.column}`);
          });
        }
      } else {
        errors.push(`Syntax Error: ${String(parseError)}`);
      }
      return {
        valid: false,
        errors,
        warnings,
      };
    }

    // Step 2: Build the schema from AST (catches some structural errors)
    let schema;
    try {
      schema = buildASTSchema(document);
    } catch (buildError: any) {
      if (buildError instanceof Error) {
        errors.push(`Schema Build Error: ${buildError.message}`);
      } else {
        errors.push(`Schema Build Error: ${String(buildError)}`);
      }
      return {
        valid: false,
        errors,
        warnings,
      };
    }

    // Step 3: Validate the schema (catches logical errors like interface implementations)
    const validationErrors = validateSchema(schema);
    
    if (validationErrors.length > 0) {
      validationErrors.forEach((error: GraphQLError) => {
        const errorMessage = error.message;
        const locations = error.locations?.map(loc => `line ${loc.line}, column ${loc.column}`).join(', ');
        if (locations) {
          errors.push(`${errorMessage} (${locations})`);
        } else {
          errors.push(errorMessage);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error: any) {
    // Catch any unexpected errors
    if (error instanceof Error) {
      errors.push(`Unexpected Error: ${error.message}`);
      if (error.stack) {
        warnings.push(`Stack trace: ${error.stack}`);
      }
    } else {
      errors.push(`Unexpected Error: ${String(error)}`);
    }
    return {
      valid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Validates multiple GraphQL schema strings and returns combined results
 * 
 * @param schemas - Array of schema SDL strings to validate
 * @returns Combined ValidationResult
 */
export function validateMultipleSchemas(schemas: string[]): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  let allValid = true;

  schemas.forEach((schema, index) => {
    const result = validateGraphQLSchema(schema);
    if (!result.valid) {
      allValid = false;
      allErrors.push(`Schema ${index + 1}:`, ...result.errors);
    }
    allWarnings.push(...result.warnings);
  });

  return {
    valid: allValid,
    errors: allErrors,
    warnings: allWarnings,
  };
}

