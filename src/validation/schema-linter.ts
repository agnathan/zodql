import { parse, visit, DocumentNode, DefinitionNode, TypeDefinitionNode, FieldDefinitionNode, InputValueDefinitionNode } from 'graphql';

export interface LintRule {
  name: string;
  severity: 'error' | 'warning';
  check: (document: DocumentNode) => LintIssue[];
}

export interface LintIssue {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  location?: {
    line: number;
    column: number;
  };
}

export interface LintResult {
  valid: boolean;
  issues: LintIssue[];
  errorCount: number;
  warningCount: number;
}

/**
 * Lints a GraphQL schema string for best practices and conventions
 * 
 * @param schemaSDL - The GraphQL Schema Definition Language string to lint
 * @param rules - Optional array of custom lint rules (uses default rules if not provided)
 * @returns LintResult with linting issues
 * 
 * @example
 * ```typescript
 * const schema = `
 *   type user {  // Should be PascalCase
 *     id: ID!
 *   }
 * `;
 * 
 * const result = lintGraphQLSchema(schema);
 * if (!result.valid) {
 *   result.issues.forEach(issue => {
 *     console.log(`${issue.severity}: ${issue.message}`);
 *   });
 * }
 * ```
 */
export function lintGraphQLSchema(
  schemaSDL: string,
  rules: LintRule[] = getDefaultLintRules()
): LintResult {
  const issues: LintIssue[] = [];

  try {
    const document = parse(schemaSDL);
    
    // Run all lint rules
    rules.forEach(rule => {
      const ruleIssues = rule.check(document);
      issues.push(...ruleIssues);
    });

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    return {
      valid: errorCount === 0,
      issues,
      errorCount,
      warningCount,
    };
  } catch (error: any) {
    // If parsing fails, return a parse error
    return {
      valid: false,
      issues: [{
        rule: 'parse-error',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
      }],
      errorCount: 1,
      warningCount: 0,
    };
  }
}

/**
 * Default lint rules for GraphQL schema best practices
 */
export function getDefaultLintRules(): LintRule[] {
  return [
    // Rule 1: Types should be PascalCase
    {
      name: 'type-naming-convention',
      severity: 'error',
      check: (document) => {
        const issues: LintIssue[] = [];
        
        visit(document, {
          TypeDefinition(node: TypeDefinitionNode) {
            const name = node.name.value;
            if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
              issues.push({
                rule: 'type-naming-convention',
                severity: 'error',
                message: `Type "${name}" should be PascalCase`,
                location: node.name.loc ? {
                  line: node.name.loc.startToken.line,
                  column: node.name.loc.startToken.column,
                } : undefined,
              });
            }
          },
        });
        
        return issues;
      },
    },

    // Rule 2: Fields should be camelCase
    {
      name: 'field-naming-convention',
      severity: 'error',
      check: (document) => {
        const issues: LintIssue[] = [];
        
        visit(document, {
          FieldDefinition(node: FieldDefinitionNode) {
            const name = node.name.value;
            if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
              issues.push({
                rule: 'field-naming-convention',
                severity: 'error',
                message: `Field "${name}" should be camelCase`,
                location: node.name.loc ? {
                  line: node.name.loc.startToken.line,
                  column: node.name.loc.startToken.column,
                } : undefined,
              });
            }
          },
        });
        
        return issues;
      },
    },

    // Rule 3: Input types should end with "Input"
    {
      name: 'input-type-naming',
      severity: 'warning',
      check: (document) => {
        const issues: LintIssue[] = [];
        
        visit(document, {
          InputObjectTypeDefinition(node) {
            const name = node.name.value;
            if (!name.endsWith('Input')) {
              issues.push({
                rule: 'input-type-naming',
                severity: 'warning',
                message: `Input type "${name}" should end with "Input"`,
                location: node.name.loc ? {
                  line: node.name.loc.startToken.line,
                  column: node.name.loc.startToken.column,
                } : undefined,
              });
            }
          },
        });
        
        return issues;
      },
    },

    // Rule 4: Enums should be PascalCase and values should be UPPER_SNAKE_CASE
    {
      name: 'enum-naming-convention',
      severity: 'warning',
      check: (document) => {
        const issues: LintIssue[] = [];
        
        visit(document, {
          EnumTypeDefinition(node) {
            const name = node.name.value;
            if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
              issues.push({
                rule: 'enum-naming-convention',
                severity: 'warning',
                message: `Enum "${name}" should be PascalCase`,
                location: node.name.loc ? {
                  line: node.name.loc.startToken.line,
                  column: node.name.loc.startToken.column,
                } : undefined,
              });
            }

            // Check enum values
            node.values?.forEach(value => {
              const valueName = value.name.value;
              if (!/^[A-Z][A-Z0-9_]*$/.test(valueName)) {
                issues.push({
                  rule: 'enum-value-naming',
                  severity: 'warning',
                  message: `Enum value "${valueName}" should be UPPER_SNAKE_CASE`,
                  location: value.name.loc ? {
                    line: value.name.loc.startToken.line,
                    column: value.name.loc.startToken.column,
                  } : undefined,
                });
              }
            });
          },
        });
        
        return issues;
      },
    },

    // Rule 5: Queries should not have side effects
    {
      name: 'query-side-effects',
      severity: 'warning',
      check: (document) => {
        const issues: LintIssue[] = [];
        
        visit(document, {
          ObjectTypeDefinition(node) {
            if (node.name.value === 'Query') {
              node.fields?.forEach(field => {
                const fieldName = field.name.value;
                // Warn if query name suggests mutation (common patterns)
                if (/^(create|update|delete|remove|add|set)/i.test(fieldName)) {
                  issues.push({
                    rule: 'query-side-effects',
                    severity: 'warning',
                    message: `Query "${fieldName}" has a name that suggests mutation. Consider moving it to Mutation type.`,
                    location: field.name.loc ? {
                      line: field.name.loc.startToken.line,
                      column: field.name.loc.startToken.column,
                    } : undefined,
                  });
                }
              });
            }
          },
        });
        
        return issues;
      },
    },

    // Rule 6: All types should have descriptions (optional but recommended)
    {
      name: 'type-descriptions',
      severity: 'warning',
      check: (document) => {
        const issues: LintIssue[] = [];
        
        visit(document, {
          TypeDefinition(node: TypeDefinitionNode) {
            if (!node.description) {
              issues.push({
                rule: 'type-descriptions',
                severity: 'warning',
                message: `Type "${node.name.value}" should have a description`,
                location: node.name.loc ? {
                  line: node.name.loc.startToken.line,
                  column: node.name.loc.startToken.column,
                } : undefined,
              });
            }
          },
        });
        
        return issues;
      },
    },
  ];
}

/**
 * Creates a custom lint rule
 */
export function createLintRule(
  name: string,
  severity: 'error' | 'warning',
  check: (document: DocumentNode) => LintIssue[]
): LintRule {
  return { name, severity, check };
}

