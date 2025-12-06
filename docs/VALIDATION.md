# GraphQL Schema Validation and Linting

ZodQL includes built-in GraphQL schema validation and linting utilities to ensure your generated schemas are correct and follow best practices.

## Schema Validator

The schema validator checks for:
- **Syntax errors**: Invalid GraphQL SDL syntax
- **Structural errors**: Missing types, incorrect interface implementations, circular references, etc.

### Usage

#### Programmatic Usage

```typescript
import { GraphQLSchemaGenerator } from 'zodql';
import { validateGraphQLSchema } from 'zodql';

// Generate a schema
const generator = new GraphQLSchemaGenerator('User', {
  schema: UserSchema,
  queries: { getUser: field({ id: Scalars.ID }, User) },
});

const schemaSDL = generator.generateSchemaFile();

// Validate it
const result = validateGraphQLSchema(schemaSDL);

if (!result.valid) {
  console.error('Schema validation failed:');
  result.errors.forEach(error => console.error(`  - ${error}`));
} else {
  console.log('✅ Schema is valid!');
}
```

#### CLI Usage

```bash
# Validate a schema file
npm run validate path/to/schema.graphql

# Validate from stdin
echo "type User { id: ID! }" | npm run validate -- --stdin
```

## Schema Linter

The schema linter enforces best practices and naming conventions:

- **Type naming**: Types must be PascalCase
- **Field naming**: Fields must be camelCase
- **Input naming**: Input types should end with "Input"
- **Enum naming**: Enums should be PascalCase, values should be UPPER_SNAKE_CASE
- **Query side effects**: Queries should not have mutation-like names
- **Type descriptions**: Types should have descriptions (warning)

### Usage

#### Programmatic Usage

```typescript
import { lintGraphQLSchema, getDefaultLintRules } from 'zodql';

const schemaSDL = generator.generateSchemaFile();
const result = lintGraphQLSchema(schemaSDL);

if (!result.valid) {
  console.error(`Found ${result.errorCount} error(s):`);
  result.issues
    .filter(i => i.severity === 'error')
    .forEach(issue => {
      console.error(`  [${issue.rule}] ${issue.message}`);
    });
}

if (result.warningCount > 0) {
  console.warn(`Found ${result.warningCount} warning(s):`);
  result.issues
    .filter(i => i.severity === 'warning')
    .forEach(issue => {
      console.warn(`  [${issue.rule}] ${issue.message}`);
    });
}
```

#### CLI Usage

```bash
# Lint a schema file
npm run lint:schema path/to/schema.graphql

# Lint from stdin
echo "type user { id: ID! }" | npm run lint:schema -- --stdin
```

### Custom Lint Rules

You can create custom lint rules:

```typescript
import { createLintRule, lintGraphQLSchema } from 'zodql';
import { visit } from 'graphql';

const customRule = createLintRule(
  'no-deprecated-fields',
  'error',
  (document) => {
    const issues = [];
    visit(document, {
      FieldDefinition(node) {
        if (node.directives?.some(d => d.name.value === 'deprecated')) {
          issues.push({
            rule: 'no-deprecated-fields',
            severity: 'error',
            message: `Field "${node.name.value}" is deprecated`,
            location: node.name.loc ? {
              line: node.name.loc.startToken.line,
              column: node.name.loc.startToken.column,
            } : undefined,
          });
        }
      },
    });
    return issues;
  }
);

const result = lintGraphQLSchema(schemaSDL, [customRule, ...getDefaultLintRules()]);
```

## Integration with ZodQL Generator

You can easily integrate validation and linting into your ZodQL workflow:

```typescript
import { GraphQLSchemaGenerator } from 'zodql';
import { validateGraphQLSchema, lintGraphQLSchema } from 'zodql';

function generateAndValidate(name: string, config: any) {
  const generator = new GraphQLSchemaGenerator(name, config);
  const schemaSDL = generator.generateSchemaFile();

  // Validate
  const validation = validateGraphQLSchema(schemaSDL);
  if (!validation.valid) {
    throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
  }

  // Lint
  const linting = lintGraphQLSchema(schemaSDL);
  if (!linting.valid) {
    console.warn('Linting issues found:');
    linting.issues.forEach(issue => {
      console.warn(`  ${issue.severity}: ${issue.message}`);
    });
  }

  return schemaSDL;
}
```

## API Reference

### `validateGraphQLSchema(schemaSDL: string): ValidationResult`

Validates a GraphQL schema string.

**Returns:**
```typescript
{
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

### `lintGraphQLSchema(schemaSDL: string, rules?: LintRule[]): LintResult`

Lints a GraphQL schema string with optional custom rules.

**Returns:**
```typescript
{
  valid: boolean;
  issues: LintIssue[];
  errorCount: number;
  warningCount: number;
}
```

### `getDefaultLintRules(): LintRule[]`

Returns the default set of lint rules.

### `createLintRule(name: string, severity: 'error' | 'warning', check: (document: DocumentNode) => LintIssue[]): LintRule`

Creates a custom lint rule.

