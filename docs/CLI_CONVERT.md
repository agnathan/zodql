# GraphQL to ZodQL Converter CLI

A command-line tool to convert GraphQL Schema Definition Language (SDL) files to ZodQL TypeScript code.

## Installation

The CLI is included with the ZodQL package. After installing ZodQL, you can use the converter:

```bash
npm install zodql
```

## Usage

### Basic Usage

Convert a GraphQL schema file to ZodQL:

```bash
zodql convert schema.graphql
```

This will generate `schema.zodql.ts` in the same directory as the input file.

### Specify Output File

```bash
zodql convert schema.graphql -o output.ts
# or
zodql convert schema.graphql --output output.ts
```

### Output to stdout

When running in a terminal, you can output directly to stdout:

```bash
zodql convert schema.graphql --no-imports | head -20
```

### Options

- `-o, --output <file>` - Specify the output file path (default: `<input-name>.zodql.ts`)
- `--no-imports` - Don't include import statements in the generated code
- `--entity-name <name>` - Specify a default entity name for the generator (default: auto-detect)
- `-h, --help` - Show help message

## Examples

### Convert a GraphQL schema

```bash
# Input: schema.graphql
type User {
  id: ID!
  username: String!
  email: String
}

type Query {
  getUser(id: ID!): User
}

# Command
zodql convert schema.graphql -o user.zodql.ts

# Output: user.zodql.ts
import { z } from 'zod';
import { Scalars, defineEnum, defineInput, defineInterface, defineObject, defineUnion, field, register } from 'zodql';
import { GraphQLSchemaGenerator } from 'zodql';

const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
    email: Scalars.String.optional(),
  },
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  queries: {
    getUser: field({
      id: Scalars.ID
    }, User.nullable()),
  },
});

const schema = generator.generateSchemaFile();
```

### Convert without imports

```bash
zodql convert schema.graphql --no-imports -o schema.zodql.ts
```

### Specify entity name

```bash
zodql convert schema.graphql --entity-name MyEntity -o schema.zodql.ts
```

## Using npm scripts

You can also use the npm script directly:

```bash
npm run convert schema.graphql
npm run convert schema.graphql -- -o output.ts
```

## Programmatic Usage

You can also use the converter programmatically:

```typescript
import { ZodQLCodeGenerator } from 'zodql';

const generator = new ZodQLCodeGenerator({
  includeImports: true,
  defaultEntityName: 'User',
});

const graphQLSchema = `
type User {
  id: ID!
  name: String!
}
`;

const zodqlCode = generator.generateZodQLCode(graphQLSchema);
console.log(zodqlCode);
```

## Supported GraphQL Features

The converter supports:

- ✅ Scalar types (ID, String, Int, Float, Boolean, AWSDateTime, AWSJSON, custom scalars)
- ✅ Object types
- ✅ Input types
- ✅ Enum types
- ✅ Interface types
- ✅ Union types
- ✅ Query operations
- ✅ Mutation operations
- ✅ Subscription operations
- ✅ Nullable and non-nullable types
- ✅ List types
- ✅ Nested types

## Error Handling

If the GraphQL schema is invalid or cannot be parsed, the converter will display an error message and exit with code 1.

## See Also

- [ZodQL Guide](./ZODQL_GUIDE.md) - Complete guide for building GraphQL schemas with ZodQL
- [GraphQL Grammar](./GRAPHQL_GRAMMAR.md) - Formal GraphQL grammar documentation
