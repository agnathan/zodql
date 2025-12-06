import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { z } from "zod";
import { GraphQLSchemaGenerator } from "../../src/generators/GraphQLSchemaGenerator.js";
import {
  Scalars,
  defineEnum,
  defineInput,
  defineInterface,
  defineObject,
  defineUnion,
  field,
  register,
  createResource,
  Registry,
} from "../../src/zodql/index.js";
import {
  captureTestInput,
  captureTestOutput,
  captureTestError,
  finalizeTest,
  writeTestSummaries,
} from "../../src/test-reporter.js";

// Store current test context
let currentTestName: string | undefined;

// Helper to capture schema output (call this with the result of generateSchemaFile())
function captureSchema(schema: string) {
  if (currentTestName) {
    captureTestOutput(schema);
  }
  return schema;
}

// Helper to wrap tests with automatic input/output capture
function withTestCapture(zodqlCode: string, testFn: () => void) {
  if (!currentTestName) {
    throw new Error("Test name not set. Make sure beforeEach is running.");
  }

  captureTestInput(currentTestName, zodqlCode);
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

describe("GraphQLSchemaGenerator - ZODQL Guide Tests", () => {
  beforeEach((ctx) => {
    // Clear registry before each test to avoid conflicts
    Registry.clear();
    // Capture test name from context
    currentTestName = ctx.task?.name;
  });

  afterEach(() => {
    // Clean up test context
    currentTestName = undefined;
  });

  afterAll(() => {
    // Write all test summaries to files
    writeTestSummaries();
  });

  describe("Scalar Types", () => {
    it("should generate GraphQL schema with built-in scalars", () => {
      const zodqlCode = `
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

      withTestCapture(zodqlCode, () => {
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

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type User");
        expect(schema).toContain("id: ID!");
        expect(schema).toContain("name: String!");
        expect(schema).toContain("age: Int!");
        expect(schema).toContain("isActive: Boolean!");
        expect(schema).toContain("createdAt: AWSDateTime!");
        expect(schema).toContain("metadata: AWSJSON!");
      });
    });

    it("should generate custom scalar types", () => {
      const zodqlCode = `
const Email = register("Email", z.string().email());
const URL = register("URL", z.string().url());

const ContactSchema = z.object({
  email: Email,
  website: URL,
});

const generator = new GraphQLSchemaGenerator("Contact", {
  schema: ContactSchema,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Email = register("Email", z.string().email());
        const URL = register("URL", z.string().url());

        const ContactSchema = z.object({
          email: Email,
          website: URL,
        });

        const generator = new GraphQLSchemaGenerator("Contact", {
          schema: ContactSchema,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        // Note: Custom scalars need to be defined separately, but the type should reference them
        expect(schema).toContain("type Contact");
        expect(schema).toContain("email:");
        expect(schema).toContain("website:");
      });
    });
  });

  describe("Enum Types", () => {
    it("should generate GraphQL enum definition", () => {
      const zodqlCode = `
const UserRole = defineEnum("UserRole", ["ADMIN", "USER", "GUEST"]);

const UserSchema = z.object({
  id: Scalars.ID,
  role: UserRole,
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: UserSchema,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const UserRole = defineEnum("UserRole", ["ADMIN", "USER", "GUEST"]);

        const UserSchema = z.object({
          id: Scalars.ID,
          role: UserRole,
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: UserSchema,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("enum UserRole");
        expect(schema).toContain("ADMIN");
        expect(schema).toContain("USER");
        expect(schema).toContain("GUEST");
        expect(schema).toContain("role: UserRole!");
      });
    });

    it("should use enum in input types", () => {
      const zodqlCode = `
const UserRole = defineEnum("UserRole", ["ADMIN", "USER", "GUEST"]);

const CreateUserInput = defineInput("CreateUserInput", {
  username: Scalars.String,
  role: UserRole,
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: z.object({ id: Scalars.ID, username: Scalars.String }),
  inputs: {
    create: CreateUserInput,
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const UserRole = defineEnum("UserRole", ["ADMIN", "USER", "GUEST"]);

        const CreateUserInput = defineInput("CreateUserInput", {
          username: Scalars.String,
          role: UserRole,
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: z.object({ id: Scalars.ID, username: Scalars.String }),
          inputs: {
            create: CreateUserInput,
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("input CreateUserInput");
        expect(schema).toContain("username: String!");
        expect(schema).toContain("role: UserRole!");
      });
    });
  });

  describe("Input Object Types", () => {
    it("should generate basic input type", () => {
      const zodqlCode = `
const CreateUserInput = defineInput("CreateUserInput", {
  username: Scalars.String,
  email: Scalars.String,
  age: Scalars.Int.optional(),
  role: defineEnum("UserRole", ["ADMIN", "USER"]),
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: z.object({ id: Scalars.ID }),
  inputs: {
    create: CreateUserInput,
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const CreateUserInput = defineInput("CreateUserInput", {
          username: Scalars.String,
          email: Scalars.String,
          age: Scalars.Int.optional(),
          role: defineEnum("UserRole", ["ADMIN", "USER"]),
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: z.object({ id: Scalars.ID }),
          inputs: {
            create: CreateUserInput,
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("input CreateUserInput");
        expect(schema).toContain("username: String!");
        expect(schema).toContain("email: String!");
        expect(schema).toContain("age: Int");
      });
    });

    it("should generate update input type with optional fields", () => {
      const zodqlCode = `
const UpdateUserInput = defineInput("UpdateUserInput", {
  username: Scalars.String.optional(),
  email: Scalars.String.optional(),
  age: Scalars.Int.optional(),
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: z.object({ id: Scalars.ID }),
  inputs: {
    update: UpdateUserInput,
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const UpdateUserInput = defineInput("UpdateUserInput", {
          username: Scalars.String.optional(),
          email: Scalars.String.optional(),
          age: Scalars.Int.optional(),
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: z.object({ id: Scalars.ID }),
          inputs: {
            update: UpdateUserInput,
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("input UpdateUserInput");
        expect(schema).toContain("username: String");
        expect(schema).toContain("email: String");
        expect(schema).toContain("age: Int");
      });
    });

    it("should generate nested input types", () => {
      const zodqlCode = `
const AddressInput = defineInput("AddressInput", {
  street: Scalars.String,
  city: Scalars.String,
  zipCode: Scalars.String,
});

const CreateUserInput = defineInput("CreateUserInput", {
  username: Scalars.String,
  address: AddressInput,
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: z.object({ id: Scalars.ID }),
  inputs: {
    create: CreateUserInput,
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const AddressInput = defineInput("AddressInput", {
          street: Scalars.String,
          city: Scalars.String,
          zipCode: Scalars.String,
        });

        const CreateUserInput = defineInput("CreateUserInput", {
          username: Scalars.String,
          address: AddressInput,
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: z.object({ id: Scalars.ID }),
          inputs: {
            create: CreateUserInput,
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("input AddressInput");
        expect(schema).toContain("input CreateUserInput");
        expect(schema).toContain("address: AddressInput!");
      });
    });

    it("should generate input types with default values", () => {
      const zodqlCode = `
const CreatePostInput = defineInput("CreatePostInput", {
  title: Scalars.String,
  content: Scalars.String,
  published: Scalars.Boolean.default(false),
  tags: z.array(Scalars.String).default([]),
});

const generator = new GraphQLSchemaGenerator("Post", {
  schema: z.object({ id: Scalars.ID }),
  inputs: {
    create: CreatePostInput,
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const CreatePostInput = defineInput("CreatePostInput", {
          title: Scalars.String,
          content: Scalars.String,
          published: Scalars.Boolean.default(false),
          tags: z.array(Scalars.String).default([]),
        });

        const generator = new GraphQLSchemaGenerator("Post", {
          schema: z.object({ id: Scalars.ID }),
          inputs: {
            create: CreatePostInput,
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("input CreatePostInput");
        expect(schema).toContain("published: Boolean! = false");
        expect(schema).toContain("tags: [String!]! = []");
      });
    });
  });

  describe("Interface Types", () => {
    it("should generate interface definition", () => {
      const zodqlCode = `
const Node = defineInterface("Node", {
  id: Scalars.ID,
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: z.object({
    id: Scalars.ID,
    createdAt: Scalars.DateTime,
    updatedAt: Scalars.DateTime,
    username: Scalars.String,
  }),
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Node = defineInterface("Node", {
          id: Scalars.ID,
          createdAt: Scalars.DateTime,
          updatedAt: Scalars.DateTime,
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: z.object({
            id: Scalars.ID,
            createdAt: Scalars.DateTime,
            updatedAt: Scalars.DateTime,
            username: Scalars.String,
          }),
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type User");
        expect(schema).toContain("id: ID!");
        expect(schema).toContain("createdAt: AWSDateTime!");
        expect(schema).toContain("updatedAt: AWSDateTime!");
        expect(schema).toContain("username: String!");
      });
    });

    it("should generate object type implementing interface", () => {
      const zodqlCode = `
const Node = defineInterface("Node", {
  id: Scalars.ID,
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

const User = defineObject("User", {
  implements: [Node],
  fields: {
    username: Scalars.String,
    email: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Node = defineInterface("Node", {
          id: Scalars.ID,
          createdAt: Scalars.DateTime,
          updatedAt: Scalars.DateTime,
        });

        const User = defineObject("User", {
          implements: [Node],
          fields: {
            username: Scalars.String,
            email: Scalars.String,
          },
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type User");
        expect(schema).toContain("id: ID!");
        expect(schema).toContain("username: String!");
        expect(schema).toContain("email: String!");
      });
    });

    it("should generate object type implementing multiple interfaces", () => {
      const zodqlCode = `
const Timestamped = defineInterface("Timestamped", {
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

const Owned = defineInterface("Owned", {
  ownerId: Scalars.ID,
});

const Post = defineObject("Post", {
  implements: [Timestamped, Owned],
  fields: {
    title: Scalars.String,
    content: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator("Post", {
  schema: Post,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Timestamped = defineInterface("Timestamped", {
          createdAt: Scalars.DateTime,
          updatedAt: Scalars.DateTime,
        });

        const Owned = defineInterface("Owned", {
          ownerId: Scalars.ID,
        });

        const Post = defineObject("Post", {
          implements: [Timestamped, Owned],
          fields: {
            title: Scalars.String,
            content: Scalars.String,
          },
        });

        const generator = new GraphQLSchemaGenerator("Post", {
          schema: Post,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Post");
        expect(schema).toContain("createdAt: AWSDateTime!");
        expect(schema).toContain("updatedAt: AWSDateTime!");
        expect(schema).toContain("ownerId: ID!");
        expect(schema).toContain("title: String!");
        expect(schema).toContain("content: String!");
      });
    });
  });

  describe("Object Types", () => {
    it("should generate basic object type", () => {
      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
    email: Scalars.String,
    age: Scalars.Int.optional(),
  },
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
            email: Scalars.String,
            age: Scalars.Int.optional(),
          },
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type User");
        expect(schema).toContain("id: ID!");
        expect(schema).toContain("username: String!");
        expect(schema).toContain("email: String!");
        expect(schema).toContain("age: Int");
      });
    });

    it("should generate object type with optional fields", () => {
      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
    email: Scalars.String.optional(),
    bio: Scalars.String.optional(),
  },
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
            email: Scalars.String.optional(),
            bio: Scalars.String.optional(),
          },
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type User");
        expect(schema).toContain("email: String");
        expect(schema).toContain("bio: String");
      });
    });

    it("should generate object type with lists", () => {
      const zodqlCode = `
const Comment = defineObject("Comment", {
  fields: {
    id: Scalars.ID,
    text: Scalars.String,
  },
});

const Post = defineObject("Post", {
  fields: {
    id: Scalars.ID,
    title: Scalars.String,
    tags: z.array(Scalars.String),
    comments: z.array(Comment),
  },
});

const generator = new GraphQLSchemaGenerator("Post", {
  schema: Post,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Comment = defineObject("Comment", {
          fields: {
            id: Scalars.ID,
            text: Scalars.String,
          },
        });

        const Post = defineObject("Post", {
          fields: {
            id: Scalars.ID,
            title: Scalars.String,
            tags: z.array(Scalars.String),
            comments: z.array(Comment),
          },
        });

        const generator = new GraphQLSchemaGenerator("Post", {
          schema: Post,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Post");
        expect(schema).toContain("tags: [String!]!");
        expect(schema).toContain("comments: [Comment!]!");
      });
    });

    it("should generate object type with nested objects", () => {
      const zodqlCode = `
const Address = defineObject("Address", {
  fields: {
    street: Scalars.String,
    city: Scalars.String,
    zipCode: Scalars.String,
  },
});

const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
    address: Address,
  },
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Address = defineObject("Address", {
          fields: {
            street: Scalars.String,
            city: Scalars.String,
            zipCode: Scalars.String,
          },
        });

        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
            address: Address,
          },
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type User");
        expect(schema).toContain("address: Address!");
      });
    });
  });

  describe("Union Types", () => {
    it("should generate union type definition", () => {
      const zodqlCode = `
const Dog = defineObject("Dog", {
  fields: {
    name: Scalars.String,
    breed: Scalars.String,
  },
});

const Cat = defineObject("Cat", {
  fields: {
    name: Scalars.String,
    livesLeft: Scalars.Int,
  },
});

const Pet = defineUnion("Pet", [Dog, Cat]);

const generator = new GraphQLSchemaGenerator("User", {
  schema: z.object({
    id: Scalars.ID,
    favoritePet: Pet,
  }),
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Dog = defineObject("Dog", {
          fields: {
            name: Scalars.String,
            breed: Scalars.String,
          },
        });

        const Cat = defineObject("Cat", {
          fields: {
            name: Scalars.String,
            livesLeft: Scalars.Int,
          },
        });

        const Pet = defineUnion("Pet", [Dog, Cat]);

        const generator = new GraphQLSchemaGenerator("User", {
          schema: z.object({
            id: Scalars.ID,
            favoritePet: Pet,
          }),
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type User");
        expect(schema).toContain("favoritePet:");
      });
    });

    it("should generate union with multiple types", () => {
      const zodqlCode = `
const Dog = defineObject("Dog", {
  fields: { name: Scalars.String, breed: Scalars.String },
});

const Cat = defineObject("Cat", {
  fields: { name: Scalars.String, livesLeft: Scalars.Int },
});

const Bird = defineObject("Bird", {
  fields: { name: Scalars.String, canFly: Scalars.Boolean },
});

const Pet = defineUnion("Pet", [Dog, Cat, Bird]);

const generator = new GraphQLSchemaGenerator("User", {
  schema: z.object({
    id: Scalars.ID,
    pet: Pet,
  }),
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Dog = defineObject("Dog", {
          fields: { name: Scalars.String, breed: Scalars.String },
        });

        const Cat = defineObject("Cat", {
          fields: { name: Scalars.String, livesLeft: Scalars.Int },
        });

        const Bird = defineObject("Bird", {
          fields: { name: Scalars.String, canFly: Scalars.Boolean },
        });

        const Pet = defineUnion("Pet", [Dog, Cat, Bird]);

        const generator = new GraphQLSchemaGenerator("User", {
          schema: z.object({
            id: Scalars.ID,
            pet: Pet,
          }),
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type User");
        expect(schema).toContain("pet:");
      });
    });
  });

  describe("Field Definitions with Arguments", () => {
    it("should generate query operations with field arguments", () => {
      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
  queries: {
    getUser: field({ id: Scalars.ID }, User),
    listUsers: field({}, z.array(User)),
    searchUsers: field({ query: Scalars.String }, z.array(User)),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
          },
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
          queries: {
            getUser: field({ id: Scalars.ID }, User),
            listUsers: field({}, z.array(User)),
            searchUsers: field({ query: Scalars.String }, z.array(User)),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Query");
        expect(schema).toContain("getUser");
        expect(schema).toContain("listUsers");
        expect(schema).toContain("searchUsers");
      });
    });

    it("should generate mutation operations with input types", () => {
      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

const CreateUserInput = defineInput("CreateUserInput", {
  username: Scalars.String,
  email: Scalars.String,
});

const UpdateUserInput = defineInput("UpdateUserInput", {
  id: Scalars.ID,
  username: Scalars.String.optional(),
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
  mutations: {
    createUser: field({ input: CreateUserInput }, User),
    updateUser: field({ input: UpdateUserInput }, User),
    deleteUser: field({ id: Scalars.ID }, Scalars.Boolean),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
          },
        });

        const CreateUserInput = defineInput("CreateUserInput", {
          username: Scalars.String,
          email: Scalars.String,
        });

        const UpdateUserInput = defineInput("UpdateUserInput", {
          id: Scalars.ID,
          username: Scalars.String.optional(),
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
          mutations: {
            createUser: field({ input: CreateUserInput }, User),
            updateUser: field({ input: UpdateUserInput }, User),
            deleteUser: field({ id: Scalars.ID }, Scalars.Boolean),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Mutation");
        expect(schema).toContain("createUser");
        expect(schema).toContain("updateUser");
        expect(schema).toContain("deleteUser");
      });
    });

    it("should generate subscription operations", () => {
      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
  subscriptions: {
    onUserCreated: field({}, User),
    onUserUpdated: field({ id: Scalars.ID }, User),
    onUserDeleted: field({}, Scalars.Boolean),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
          },
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
          subscriptions: {
            onUserCreated: field({}, User),
            onUserUpdated: field({ id: Scalars.ID }, User),
            onUserDeleted: field({}, Scalars.Boolean),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Subscription");
        expect(schema).toContain("onUserCreated");
        expect(schema).toContain("onUserUpdated");
        expect(schema).toContain("onUserDeleted");
      });
    });

    it("should generate field with optional arguments", () => {
      const zodqlCode = `
const Post = defineObject("Post", {
  fields: {
    id: Scalars.ID,
    title: Scalars.String,
  },
});

const PostFilter = defineInput("PostFilter", {
  status: Scalars.String.optional(),
});

const generator = new GraphQLSchemaGenerator("Post", {
  schema: Post,
  queries: {
    listPosts: field(
      {
        filter: PostFilter.optional(),
        limit: Scalars.Int.optional(),
      },
      z.array(Post)
    ),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Post = defineObject("Post", {
          fields: {
            id: Scalars.ID,
            title: Scalars.String,
          },
        });

        const PostFilter = defineInput("PostFilter", {
          status: Scalars.String.optional(),
        });

        const generator = new GraphQLSchemaGenerator("Post", {
          schema: Post,
          queries: {
            listPosts: field(
              {
                filter: PostFilter.optional(),
                limit: Scalars.Int.optional(),
              },
              z.array(Post)
            ),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("listPosts");
      });
    });
  });

  describe("Root Operations", () => {
    it("should generate Query type with operations", () => {
      const User = defineObject("User", {
        fields: {
          id: Scalars.ID,
          username: Scalars.String,
        },
      });

      const Query = defineObject("Query", {
        fields: {
          getUser: User,
          listUsers: z.array(User),
        },
      });

      const generator = new GraphQLSchemaGenerator("User", {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
          listUsers: field({}, z.array(User)),
        },
      });

      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

const Query = defineObject("Query", {
  fields: {
    getUser: User,
    listUsers: z.array(User),
  },
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
  queries: {
    getUser: field({ id: Scalars.ID }, User),
    listUsers: field({}, z.array(User)),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
          },
        });

        const Query = defineObject("Query", {
          fields: {
            getUser: User,
            listUsers: z.array(User),
          },
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
          queries: {
            getUser: field({ id: Scalars.ID }, User),
            listUsers: field({}, z.array(User)),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Query");
        expect(schema).toContain("getUser");
        expect(schema).toContain("listUsers");
      });
    });

    it("should generate Mutation type with operations", () => {
      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

const CreateUserInput = defineInput("CreateUserInput", {
  username: Scalars.String,
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
  mutations: {
    createUser: field({ input: CreateUserInput }, User),
    updateUser: field({ input: CreateUserInput }, User),
    deleteUser: field({ id: Scalars.ID }, Scalars.Boolean),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
          },
        });

        const CreateUserInput = defineInput("CreateUserInput", {
          username: Scalars.String,
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
          mutations: {
            createUser: field({ input: CreateUserInput }, User),
            updateUser: field({ input: CreateUserInput }, User),
            deleteUser: field({ id: Scalars.ID }, Scalars.Boolean),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Mutation");
        expect(schema).toContain("createUser");
        expect(schema).toContain("updateUser");
        expect(schema).toContain("deleteUser");
      });
    });

    it("should generate Subscription type with operations", () => {
      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
  subscriptions: {
    onUserCreated: field({}, User),
    onUserUpdated: field({ id: Scalars.ID }, User),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
          },
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
          subscriptions: {
            onUserCreated: field({}, User),
            onUserUpdated: field({ id: Scalars.ID }, User),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Subscription");
        expect(schema).toContain("onUserCreated");
        expect(schema).toContain("onUserUpdated");
      });
    });
  });

  describe("Resource Factory Pattern", () => {
    it("should generate CRUD operations from resource factory", () => {
      const zodqlCode = `
const PostResource = createResource("Post", {
  title: Scalars.String,
  content: Scalars.String,
  authorId: Scalars.ID,
});

const generator = new GraphQLSchemaGenerator("Post", {
  schema: PostResource.Schemas.Entity,
  inputs: {
    create: PostResource.Schemas.CreateInput,
    update: PostResource.Schemas.UpdateInput,
  },
  queries: PostResource.ops.query,
  mutations: PostResource.ops.mutation,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const PostResource = createResource("Post", {
          title: Scalars.String,
          content: Scalars.String,
          authorId: Scalars.ID,
        });

        const generator = new GraphQLSchemaGenerator("Post", {
          schema: PostResource.Schemas.Entity,
          inputs: {
            create: PostResource.Schemas.CreateInput,
            update: PostResource.Schemas.UpdateInput,
          },
          queries: PostResource.ops.query,
          mutations: PostResource.ops.mutation,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Post");
        expect(schema).toContain("id: ID!");
        expect(schema).toContain("title: String!");
        expect(schema).toContain("content: String!");
        expect(schema).toContain("createdAt:");
        expect(schema).toContain("updatedAt:");
        expect(schema).toContain("input CreatePostInput");
        expect(schema).toContain("input UpdatePostInput");
        expect(schema).toContain("getPost");
        expect(schema).toContain("listPosts");
        expect(schema).toContain("createPost");
        expect(schema).toContain("updatePost");
        expect(schema).toContain("deletePost");
      });
    });

    it("should generate connection type for list operations", () => {
      const zodqlCode = `
const PostResource = createResource("Post", {
  title: Scalars.String,
  content: Scalars.String,
});

const PostConnection = z.object({
  items: z.array(PostResource.Schemas.Entity),
  nextToken: Scalars.String.optional(),
});

const generator = new GraphQLSchemaGenerator("Post", {
  schema: PostResource.Schemas.Entity,
  connections: {
    list: PostConnection,
  },
  queries: {
    listPosts: field({}, PostConnection),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const PostResource = createResource("Post", {
          title: Scalars.String,
          content: Scalars.String,
        });

        const PostConnection = z.object({
          items: z.array(PostResource.Schemas.Entity),
          nextToken: Scalars.String.optional(),
        });

        const generator = new GraphQLSchemaGenerator("Post", {
          schema: PostResource.Schemas.Entity,
          connections: {
            list: PostConnection,
          },
          queries: {
            listPosts: field({}, PostConnection),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type PostConnection");
        expect(schema).toContain("items: [Post!]!");
        expect(schema).toContain("nextToken: String");
      });
    });
  });

  describe("Complete Examples", () => {
    it("should generate Blog API schema", () => {
      const zodqlCode = `
const PostStatus = defineEnum("PostStatus", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

const Node = defineInterface("Node", {
  id: Scalars.ID,
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

const CreatePostInput = defineInput("CreatePostInput", {
  title: Scalars.String,
  content: Scalars.String,
  status: PostStatus,
});

const User = defineObject("User", {
  implements: [Node],
  fields: {
    username: Scalars.String,
    email: Scalars.String,
  },
});

const Post = defineObject("Post", {
  implements: [Node],
  fields: {
    title: Scalars.String,
    content: Scalars.String,
    status: PostStatus,
    authorId: Scalars.ID,
  },
});

const generator = new GraphQLSchemaGenerator("Post", {
  schema: Post,
  inputs: {
    create: CreatePostInput,
  },
  queries: {
    getPost: field({ id: Scalars.ID }, Post),
    listPosts: field({}, z.array(Post)),
  },
  mutations: {
    createPost: field({ input: CreatePostInput }, Post),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const PostStatus = defineEnum("PostStatus", [
          "DRAFT",
          "PUBLISHED",
          "ARCHIVED",
        ]);

        const Node = defineInterface("Node", {
          id: Scalars.ID,
          createdAt: Scalars.DateTime,
          updatedAt: Scalars.DateTime,
        });

        const CreatePostInput = defineInput("CreatePostInput", {
          title: Scalars.String,
          content: Scalars.String,
          status: PostStatus,
        });

        const User = defineObject("User", {
          implements: [Node],
          fields: {
            username: Scalars.String,
            email: Scalars.String,
          },
        });

        const Post = defineObject("Post", {
          implements: [Node],
          fields: {
            title: Scalars.String,
            content: Scalars.String,
            status: PostStatus,
            authorId: Scalars.ID,
          },
        });

        const generator = new GraphQLSchemaGenerator("Post", {
          schema: Post,
          inputs: {
            create: CreatePostInput,
          },
          queries: {
            getPost: field({ id: Scalars.ID }, Post),
            listPosts: field({}, z.array(Post)),
          },
          mutations: {
            createPost: field({ input: CreatePostInput }, Post),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("enum PostStatus");
        expect(schema).toContain("type Post");
        expect(schema).toContain("input CreatePostInput");
        expect(schema).toContain("getPost");
        expect(schema).toContain("listPosts");
        expect(schema).toContain("createPost");
      });
    });

    it("should generate complex schema with unions and interfaces", () => {
      const zodqlCode = `
const Node = defineInterface("Node", {
  id: Scalars.ID,
});

const Timestamped = defineInterface("Timestamped", {
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

const User = defineObject("User", {
  implements: [Node, Timestamped],
  fields: {
    username: Scalars.String,
  },
});

const Post = defineObject("Post", {
  implements: [Node, Timestamped],
  fields: {
    title: Scalars.String,
  },
});

const SearchResult = defineUnion("SearchResult", [User, Post]);

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
  queries: {
    search: field({ query: Scalars.String }, z.array(SearchResult)),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Node = defineInterface("Node", {
          id: Scalars.ID,
        });

        const Timestamped = defineInterface("Timestamped", {
          createdAt: Scalars.DateTime,
          updatedAt: Scalars.DateTime,
        });

        const User = defineObject("User", {
          implements: [Node, Timestamped],
          fields: {
            username: Scalars.String,
          },
        });

        const Post = defineObject("Post", {
          implements: [Node, Timestamped],
          fields: {
            title: Scalars.String,
          },
        });

        const SearchResult = defineUnion("SearchResult", [User, Post]);

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
          queries: {
            search: field({ query: Scalars.String }, z.array(SearchResult)),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type User");
        expect(schema).toContain("id: ID!");
        expect(schema).toContain("createdAt:");
        expect(schema).toContain("search");
      });
    });
  });

  describe("Edge Cases and Advanced Features", () => {
    it("should handle empty input types gracefully", () => {
      const zodqlCode = `
const EmptyInput = defineInput("EmptyInput", {});

const generator = new GraphQLSchemaGenerator("Test", {
  schema: z.object({ id: Scalars.ID }),
  inputs: {
    create: EmptyInput,
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const EmptyInput = defineInput("EmptyInput", {});

        const generator = new GraphQLSchemaGenerator("Test", {
          schema: z.object({ id: Scalars.ID }),
          inputs: {
            create: EmptyInput,
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        // Empty input types should not cause errors
        expect(schema).toBeTruthy();
      });
    });

    it("should handle relationships as fields", () => {
      const zodqlCode = `
const Comment = defineObject("Comment", {
  fields: {
    id: Scalars.ID,
    text: Scalars.String,
  },
});

const Post = defineObject("Post", {
  fields: {
    id: Scalars.ID,
    title: Scalars.String,
    comments: z.array(Comment), // Relationship field - type-safe!
  },
});

const generator = new GraphQLSchemaGenerator("Post", {
  schema: Post,
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const Comment = defineObject("Comment", {
          fields: {
            id: Scalars.ID,
            text: Scalars.String,
          },
        });

        const Post = defineObject("Post", {
          fields: {
            id: Scalars.ID,
            title: Scalars.String,
            comments: z.array(Comment), // Relationship field - type-safe!
          },
        });

        const generator = new GraphQLSchemaGenerator("Post", {
          schema: Post,
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("type Post");
        expect(schema).toContain("comments:");
        expect(schema).toContain("[Comment!]!");
      });
    });

    it("should handle auth directives", () => {
      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
  auth: [
    { type: "iam" },
    { type: "cognito_user_pools", cognitoGroups: ["Admins"] },
  ],
  queries: {
    getUser: field({ id: Scalars.ID }, User),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
          },
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
          auth: [
            { type: "iam" },
            { type: "cognito_user_pools", cognitoGroups: ["Admins"] },
          ],
          queries: {
            getUser: field({ id: Scalars.ID }, User),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("@aws_iam");
        expect(schema).toContain("@aws_cognito_user_pools");
      });
    });

    it("should handle key input types", () => {
      const zodqlCode = `
const User = defineObject("User", {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

const PrimaryKeyInput = defineInput("PrimaryKeyInput", {
  id: Scalars.ID,
});

const CompositeKeyInput = defineInput("CompositeKeyInput", {
  id: Scalars.ID,
  parentId: Scalars.ID,
});

const generator = new GraphQLSchemaGenerator("User", {
  schema: User,
  keys: {
    primary: PrimaryKeyInput,
    composite: CompositeKeyInput,
  },
  queries: {
    getUser: field({ id: Scalars.ID }, User),
  },
});

const schema = generator.generateSchemaFile();
`.trim();

      withTestCapture(zodqlCode, () => {
        const User = defineObject("User", {
          fields: {
            id: Scalars.ID,
            username: Scalars.String,
          },
        });

        const PrimaryKeyInput = defineInput("PrimaryKeyInput", {
          id: Scalars.ID,
        });

        const CompositeKeyInput = defineInput("CompositeKeyInput", {
          id: Scalars.ID,
          parentId: Scalars.ID,
        });

        const generator = new GraphQLSchemaGenerator("User", {
          schema: User,
          keys: {
            primary: PrimaryKeyInput,
            composite: CompositeKeyInput,
          },
          queries: {
            getUser: field({ id: Scalars.ID }, User),
          },
        });

        const schema = captureSchema(generator.generateSchemaFile());

        expect(schema).toContain("input PrimaryKeyInput");
        expect(schema).toContain("input CompositeKeyInput");
      });
    });
  });
});
