import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { ZodQLCodeGenerator } from "../src/generators/ZodQLCodeGenerator.js";
import {
  captureTestInput,
  captureTestOutput,
  captureTestError,
  finalizeTest,
  writeTestSummaries,
  setDescribeBlock,
  setTestFileName,
} from "../src/test-reporter.js";

// Store current test context
let currentTestName: string | undefined;
let currentDescribeBlock: string | undefined;

// Helper to capture ZodQL code output
function captureZodQLCode(code: string) {
  if (currentTestName) {
    captureTestOutput(code);
  }
  return code;
}

// Helper to wrap tests with automatic input/output capture
function withTestCapture(graphQLSchema: string, testFn: () => void) {
  if (!currentTestName) {
    throw new Error("Test name not set. Make sure beforeEach is running.");
  }

  captureTestInput(currentTestName, graphQLSchema);
  let passed = false;

  try {
    testFn();
    passed = true;
  } catch (error: any) {
    captureTestError(error.message || String(error));
    throw error;
  } finally {
    finalizeTest(passed);
  }
}

describe("ZodQLCodeGenerator - Reverse Tests", () => {
  beforeEach((ctx) => {
    // Capture test file name from context
    const filePath = ctx.task?.file?.name || 'zodql-code-generator.test.ts';
    const fileName = filePath.split(/[/\\]/).pop() || 'zodql-code-generator.test.ts';
    setTestFileName(fileName);
    // Capture test name from context
    currentTestName = ctx.task?.name;
    // Capture describe block name from suite hierarchy
    let suite = ctx.task?.suite;
    // Traverse up the suite tree to find the immediate describe block
    // (skip the root suite and find the first named suite)
    while (suite) {
      if (suite.name && suite.name !== '') {
        currentDescribeBlock = suite.name;
        setDescribeBlock(currentDescribeBlock);
        break;
      }
      suite = (suite as any).parent;
    }
    if (!currentDescribeBlock) {
      setDescribeBlock('Uncategorized');
    }
  });

  afterEach(() => {
    // Clean up test context
    currentTestName = undefined;
    currentDescribeBlock = undefined;
  });

  afterAll(() => {
    // Write all test summaries to files
    writeTestSummaries();
  });

  describe("Scalar Types", () => {
    it("should generate ZodQL code from GraphQL schema with built-in scalars", () => {
      const graphQLSchema = `
type User {
  id: ID!
  name: String!
  age: Int!
  isActive: Boolean!
  createdAt: AWSDateTime!
  metadata: AWSJSON!
}
`.trim();

      const expectedZodQL = `
const UserSchema = z.object({
  id: Scalars.ID,
  name: Scalars.String,
  age: Scalars.Int,
  isActive: Scalars.Boolean,
  createdAt: Scalars.DateTime,
  metadata: Scalars.JSON,
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: UserSchema,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("Scalars.ID");
        expect(zodqlCode).toContain("Scalars.String");
        expect(zodqlCode).toContain("Scalars.Int");
        expect(zodqlCode).toContain("Scalars.Boolean");
        expect(zodqlCode).toContain("Scalars.DateTime");
        expect(zodqlCode).toContain("Scalars.JSON");
        expect(zodqlCode).toContain("defineObject('User'");
      });
    });

    it("should generate custom scalar types", () => {
      const graphQLSchema = `
scalar Email
scalar URL

type Contact {
  email: Email!
  website: URL!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("register('Email'");
        expect(zodqlCode).toContain("register('URL'");
        expect(zodqlCode).toContain("defineObject('Contact'");
      });
    });
  });

  describe("Enum Types", () => {
    it("should generate GraphQL enum definition", () => {
      const graphQLSchema = `
enum UserRole {
  ADMIN
  USER
  GUEST
}

type User {
  id: ID!
  role: UserRole!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineEnum('UserRole'");
        expect(zodqlCode).toContain('"ADMIN"');
        expect(zodqlCode).toContain('"USER"');
        expect(zodqlCode).toContain('"GUEST"');
        expect(zodqlCode).toContain("role: UserRole");
      });
    });

    it("should use enum in input types", () => {
      const graphQLSchema = `
enum UserRole {
  ADMIN
  USER
  GUEST
}

input CreateUserInput {
  username: String!
  role: UserRole!
}

type User {
  id: ID!
  username: String!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineEnum('UserRole'");
        expect(zodqlCode).toContain("defineInput('CreateUserInput'");
        expect(zodqlCode).toContain("role: UserRole");
      });
    });
  });

  describe("Input Object Types", () => {
    it("should generate basic input type", () => {
      const graphQLSchema = `
input CreateUserInput {
  username: String!
  email: String!
  age: Int
}

type User {
  id: ID!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineInput('CreateUserInput'");
        expect(zodqlCode).toContain("username: Scalars.String");
        expect(zodqlCode).toContain("email: Scalars.String");
        expect(zodqlCode).toContain("age: Scalars.Int.optional()");
      });
    });

    it("should generate update input type with optional fields", () => {
      const graphQLSchema = `
input UpdateUserInput {
  username: String
  email: String
  age: Int
}

type User {
  id: ID!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineInput('UpdateUserInput'");
        expect(zodqlCode).toContain("username: Scalars.String.optional()");
        expect(zodqlCode).toContain("email: Scalars.String.optional()");
        expect(zodqlCode).toContain("age: Scalars.Int.optional()");
      });
    });

    it("should generate nested input types", () => {
      const graphQLSchema = `
input AddressInput {
  street: String!
  city: String!
  zipCode: String!
}

input CreateUserInput {
  username: String!
  address: AddressInput!
}

type User {
  id: ID!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineInput('AddressInput'");
        expect(zodqlCode).toContain("defineInput('CreateUserInput'");
        expect(zodqlCode).toContain("address: AddressInput");
      });
    });
  });

  describe("Interface Types", () => {
    it("should generate interface definition", () => {
      const graphQLSchema = `
interface Node {
  id: ID!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type User implements Node {
  id: ID!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  username: String!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineInterface('Node'");
        expect(zodqlCode).toContain("defineObject('User'");
        expect(zodqlCode).toContain("implements: [Node]");
      });
    });

    it("should generate object type implementing interface", () => {
      const graphQLSchema = `
interface Node {
  id: ID!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type User implements Node {
  username: String!
  email: String!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineInterface('Node'");
        expect(zodqlCode).toContain("defineObject('User'");
        expect(zodqlCode).toContain("implements: [Node]");
        expect(zodqlCode).toContain("username: Scalars.String");
        expect(zodqlCode).toContain("email: Scalars.String");
      });
    });

    it("should generate object type implementing multiple interfaces", () => {
      const graphQLSchema = `
interface Timestamped {
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

interface Owned {
  ownerId: ID!
}

type Post implements Timestamped & Owned {
  title: String!
  content: String!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineInterface('Timestamped'");
        expect(zodqlCode).toContain("defineInterface('Owned'");
        expect(zodqlCode).toContain("defineObject('Post'");
        expect(zodqlCode).toContain("implements: [Timestamped, Owned]");
      });
    });
  });

  describe("Object Types", () => {
    it("should generate basic object type", () => {
      const graphQLSchema = `
type User {
  id: ID!
  username: String!
  email: String!
  age: Int
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineObject('User'");
        expect(zodqlCode).toContain("id: Scalars.ID");
        expect(zodqlCode).toContain("username: Scalars.String");
        expect(zodqlCode).toContain("email: Scalars.String");
        expect(zodqlCode).toContain("age: Scalars.Int.optional()");
      });
    });

    it("should generate object type with lists", () => {
      const graphQLSchema = `
type Post {
  id: ID!
  title: String!
  tags: [String!]!
  comments: [Comment!]!
}

type Comment {
  id: ID!
  text: String!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("tags: z.array(Scalars.String)");
        expect(zodqlCode).toContain("comments: z.array(Comment)");
      });
    });

    it("should generate object type with nested objects", () => {
      const graphQLSchema = `
type Address {
  street: String!
  city: String!
  zipCode: String!
}

type User {
  id: ID!
  name: String!
  address: Address!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineObject('Address'");
        expect(zodqlCode).toContain("defineObject('User'");
        expect(zodqlCode).toContain("address: Address");
      });
    });

    it("should generate object type with optional fields", () => {
      const graphQLSchema = `
type User {
  id: ID!
  username: String!
  email: String
  bio: String
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("username: Scalars.String");
        expect(zodqlCode).toContain("email: Scalars.String.optional()");
        expect(zodqlCode).toContain("bio: Scalars.String.optional()");
      });
    });
  });

  describe("Union Types", () => {
    it("should generate union type definition", () => {
      const graphQLSchema = `
type Dog {
  name: String!
  breed: String!
}

type Cat {
  name: String!
  lives: Int!
}

union Pet = Dog | Cat
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineUnion('Pet'");
        expect(zodqlCode).toContain("[Dog, Cat]");
      });
    });

    it("should generate union with multiple types", () => {
      const graphQLSchema = `
type Image {
  url: String!
}

type Video {
  url: String!
}

type Audio {
  url: String!
}

union Media = Image | Video | Audio
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineUnion('Media'");
        expect(zodqlCode).toContain("[Image, Video, Audio]");
      });
    });
  });

  describe("Query Operations", () => {
    it("should generate Query type with operations", () => {
      const graphQLSchema = `
type User {
  id: ID!
  name: String!
}

type Query {
  getUser(id: ID!): User!
  listUsers: [User!]!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("queries: {");
        expect(zodqlCode).toContain("getUser: field({");
        expect(zodqlCode).toContain("id: Scalars.ID");
        expect(zodqlCode).toContain("listUsers: field({}, z.array(User))");
      });
    });

    it("should generate query operations with field arguments", () => {
      const graphQLSchema = `
type User {
  id: ID!
  name: String!
}

type Query {
  searchUsers(query: String, limit: Int): [User!]!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("searchUsers: field({");
        expect(zodqlCode).toContain("query: Scalars.String.optional()");
        expect(zodqlCode).toContain("limit: Scalars.Int.optional()");
      });
    });
  });

  describe("Mutation Operations", () => {
    it("should generate Mutation type with operations", () => {
      const graphQLSchema = `
type User {
  id: ID!
  name: String!
}

input CreateUserInput {
  name: String!
  email: String!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("mutations: {");
        expect(zodqlCode).toContain("createUser: field({");
        expect(zodqlCode).toContain("input: CreateUserInput");
        expect(zodqlCode).toContain("deleteUser: field({");
      });
    });

    it("should generate mutation operations with input types", () => {
      const graphQLSchema = `
type User {
  id: ID!
  username: String!
}

input CreateUserInput {
  username: String!
  email: String!
}

input UpdateUserInput {
  username: String
  email: String
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineInput('CreateUserInput'");
        expect(zodqlCode).toContain("defineInput('UpdateUserInput'");
        expect(zodqlCode).toContain("createUser: field({");
        expect(zodqlCode).toContain("updateUser: field({");
      });
    });
  });

  describe("Subscription Operations", () => {
    it("should generate Subscription type with operations", () => {
      const graphQLSchema = `
type User {
  id: ID!
  name: String!
}

type Subscription {
  userUpdated(id: ID!): User!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("subscriptions: {");
        expect(zodqlCode).toContain("userUpdated: field({");
      });
    });

    it("should generate subscription operations", () => {
      const graphQLSchema = `
type Post {
  id: ID!
  title: String!
}

type Subscription {
  postCreated: Post!
  postUpdated(id: ID!): Post!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("postCreated: field({}, Post)");
        expect(zodqlCode).toContain("postUpdated: field({");
      });
    });
  });

  describe("Complex Schemas", () => {
    it("should generate complex schema with unions and interfaces", () => {
      const graphQLSchema = `
interface Node {
  id: ID!
}

type User implements Node {
  id: ID!
  username: String!
}

type Post implements Node {
  id: ID!
  title: String!
}

union SearchResult = User | Post

type Query {
  search(query: String!): [SearchResult!]!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineInterface('Node'");
        expect(zodqlCode).toContain("defineObject('User'");
        expect(zodqlCode).toContain("defineObject('Post'");
        expect(zodqlCode).toContain("defineUnion('SearchResult'");
        expect(zodqlCode).toContain("search: field({");
      });
    });

    it("should generate Blog API schema", () => {
      const graphQLSchema = `
type User {
  id: ID!
  username: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  published: Boolean!
}

input CreatePostInput {
  title: String!
  content: String!
  authorId: ID!
}

type Query {
  getUser(id: ID!): User
  getPost(id: ID!): Post
  listPosts: [Post!]!
}

type Mutation {
  createPost(input: CreatePostInput!): Post!
  publishPost(id: ID!): Post!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineObject('User'");
        expect(zodqlCode).toContain("defineObject('Post'");
        expect(zodqlCode).toContain("defineInput('CreatePostInput'");
        expect(zodqlCode).toContain("queries: {");
        expect(zodqlCode).toContain("mutations: {");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty input types gracefully", () => {
      const graphQLSchema = `
input EmptyInput {
  _placeholder: String
}

type User {
  id: ID!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineInput('EmptyInput'");
        expect(zodqlCode).toContain("_placeholder: Scalars.String.optional()");
        expect(zodqlCode).toBeTruthy();
      });
    });

    it("should handle relationships as fields", () => {
      const graphQLSchema = `
type Comment {
  id: ID!
  text: String!
}

type Post {
  id: ID!
  title: String!
  comments: [Comment!]!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("defineObject('Comment'");
        expect(zodqlCode).toContain("defineObject('Post'");
        expect(zodqlCode).toContain("comments: z.array(Comment)");
      });
    });

    it("should handle nullable return types in queries", () => {
      const graphQLSchema = `
type User {
  id: ID!
  name: String!
}

type Query {
  findUser(id: ID!): User
  getUser(id: ID!): User!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("findUser: field({");
        expect(zodqlCode).toContain("getUser: field({");
        // Nullable return type should be nullable, non-null should be required
        expect(zodqlCode).toMatch(/findUser.*User\.nullable\(\)/s);
        expect(zodqlCode).toMatch(/getUser.*User[^.]/s);
      });
    });

    it("should handle operations returning scalars", () => {
      const graphQLSchema = `
type Mutation {
  deleteUser(id: ID!): Boolean!
  getUserCount: Int!
}
`.trim();

      withTestCapture(graphQLSchema, () => {
        const generator = new ZodQLCodeGenerator({ includeImports: true });
        const zodqlCode = captureZodQLCode(generator.generateZodQLCode(graphQLSchema));

        expect(zodqlCode).toContain("deleteUser: field({");
        expect(zodqlCode).toContain("getUserCount: field({}, Scalars.Int)");
        expect(zodqlCode).toMatch(/deleteUser[\s\S]*Scalars\.Boolean/);
      });
    });
  });
});
