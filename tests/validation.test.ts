import { describe, it, expect, beforeEach } from 'vitest';
import { validateGraphQLSchema, validateMultipleSchemas } from '../src/validation/schema-validator.js';
import { lintGraphQLSchema, getDefaultLintRules } from '../src/validation/schema-linter.js';
import { GraphQLSchemaGenerator } from '../src/generators/GraphQLSchemaGenerator.js';
import { Scalars, defineEnum, defineInput, defineObject, defineInterface, defineUnion, register, field, Registry } from '../src/zodql/index.js';
import { z } from 'zod';

describe('GraphQL Schema Validator', () => {
  it('should validate a correct schema', () => {
    const schema = `
      type Query {
        user: User
      }
      
      type User {
        id: ID!
        name: String!
      }
    `;

    const result = validateGraphQLSchema(schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect syntax errors', () => {
    const schema = `
      type User {
        id: ID!
        name: String!  // Missing closing brace
    `;

    const result = validateGraphQLSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should detect structural errors', () => {
    const schema = `
      type User implements NonExistentInterface {
        id: ID!
        name: String!
      }
    `;

    const result = validateGraphQLSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate multiple schemas', () => {
    const schemas = [
      `type Query { user: User } type User { id: ID! }`,
      `type Query { post: Post } type Post { id: ID! }`,
    ];

    const result = validateMultipleSchemas(schemas);
    expect(result.valid).toBe(true);
  });
});

describe('GraphQL Schema Linter', () => {
  it('should lint a schema with naming convention violations', () => {
    const schema = `
      type user {  # Should be PascalCase
        id: ID!
        UserName: String!  # Should be camelCase
      }
    `;

    const result = lintGraphQLSchema(schema);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it('should pass linting for correctly named schema', () => {
    const schema = `
      type User {
        id: ID!
        userName: String!
      }
    `;

    const result = lintGraphQLSchema(schema);
    // Should have warnings for missing descriptions, but no errors
    expect(result.errorCount).toBe(0);
  });

  it('should detect input type naming issues', () => {
    const schema = `
      input CreateUser {  # Should end with "Input"
        name: String!
      }
    `;

    const result = lintGraphQLSchema(schema);
    const inputNamingIssues = result.issues.filter(i => i.rule === 'input-type-naming');
    expect(inputNamingIssues.length).toBeGreaterThan(0);
  });

  it('should detect enum naming issues', () => {
    const schema = `
      enum userRole {  # Should be PascalCase
        admin  # Should be UPPER_SNAKE_CASE
        regular_user
      }
    `;

    const result = lintGraphQLSchema(schema);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('Validator and Linter on GraphQLSchemaGenerator Output', () => {
  beforeEach(() => {
    Registry.clear();
  });

  it('should validate and lint generated schema with scalars', async () => {
    const User = defineObject('User', {
      fields: {
        id: Scalars.ID,
        name: Scalars.String,
        age: Scalars.Int,
      },
    });

    const generator = new GraphQLSchemaGenerator('User', {
      schema: User,
      queries: {
        getUser: field({ id: Scalars.ID }, User),
      },
    });

    const schema = await generator.generateSchemaFile();

    // Validate
    const validation = validateGraphQLSchema(schema);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
    }
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Lint
    const linting = lintGraphQLSchema(schema);
    if (linting.errorCount > 0) {
      console.error('Linting errors:', linting.issues.filter(i => i.severity === 'error'));
    }
    expect(linting.errorCount).toBe(0);
    // May have warnings for missing descriptions, which is acceptable
  });

  it('should validate and lint generated schema with enums', async () => {
    const UserRole = defineEnum('UserRole', ['ADMIN', 'USER', 'GUEST']);
    const User = defineObject('User', {
      fields: {
        id: Scalars.ID,
        role: UserRole,
      },
    });

    const generator = new GraphQLSchemaGenerator('User', {
      schema: User,
      queries: {
        getUser: field({ id: Scalars.ID }, User),
      },
    });

    const schema = await generator.generateSchemaFile();

    // Validate
    const validation = validateGraphQLSchema(schema);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
    }
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Lint
    const linting = lintGraphQLSchema(schema);
    if (linting.errorCount > 0) {
      console.error('Linting errors:', linting.issues.filter(i => i.severity === 'error'));
    }
    expect(linting.errorCount).toBe(0);
  });

  it('should validate and lint generated schema with input types', async () => {
    const CreateUserInput = defineInput('CreateUserInput', {
      username: Scalars.String,
      email: Scalars.String,
    });

    const User = defineObject('User', {
      fields: {
        id: Scalars.ID,
        username: Scalars.String,
      },
    });

    const generator = new GraphQLSchemaGenerator('User', {
      schema: User,
      inputs: {
        create: CreateUserInput,
      },
      queries: {
        getUser: field({ id: Scalars.ID }, User),
      },
      mutations: {
        createUser: field({ input: CreateUserInput }, User),
      },
    });

    const schema = await generator.generateSchemaFile();

    // Validate
    const validation = validateGraphQLSchema(schema);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
    }
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Lint
    const linting = lintGraphQLSchema(schema);
    if (linting.errorCount > 0) {
      console.error('Linting errors:', linting.issues.filter(i => i.severity === 'error'));
    }
    expect(linting.errorCount).toBe(0);
  });

  it('should validate and lint generated schema with queries, mutations, and subscriptions', async () => {
    const User = defineObject('User', {
      fields: {
        id: Scalars.ID,
        username: Scalars.String,
      },
    });

    const generator = new GraphQLSchemaGenerator('User', {
      schema: User,
      queries: {
        getUser: field({ id: Scalars.ID }, User),
        listUsers: field({}, z.array(User)),
      },
      mutations: {
        createUser: field({ username: Scalars.String }, User),
      },
      subscriptions: {
        onUserCreated: field({}, User),
      },
    });

    const schema = await generator.generateSchemaFile();

    // Validate
    const validation = validateGraphQLSchema(schema);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
    }
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Lint
    const linting = lintGraphQLSchema(schema);
    if (linting.errorCount > 0) {
      console.error('Linting errors:', linting.issues.filter(i => i.severity === 'error'));
    }
    expect(linting.errorCount).toBe(0);
  });

  it('should validate and lint complex generated schema with unions and interfaces', async () => {
    const Node = defineInterface('Node', {
      id: Scalars.ID,
    });

    const Timestamped = defineInterface('Timestamped', {
      createdAt: Scalars.DateTime,
      updatedAt: Scalars.DateTime,
    });

    const User = defineObject('User', {
      implements: [Node, Timestamped],
      fields: {
        username: Scalars.String,
      },
    });

    const Post = defineObject('Post', {
      implements: [Node, Timestamped],
      fields: {
        title: Scalars.String,
      },
    });

    const SearchResult = defineUnion('SearchResult', [User, Post]);

    const generator = new GraphQLSchemaGenerator('User', {
      schema: User,
      queries: {
        search: field({ query: Scalars.String }, z.array(SearchResult)),
      },
    });

    const schema = await generator.generateSchemaFile();

    // Validate
    const validation = validateGraphQLSchema(schema);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
    }
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Lint
    const linting = lintGraphQLSchema(schema);
    if (linting.errorCount > 0) {
      console.error('Linting errors:', linting.issues.filter(i => i.severity === 'error'));
    }
    expect(linting.errorCount).toBe(0);
  });
});

