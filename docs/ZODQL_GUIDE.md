# ZodQL Guide: Building GraphQL Schemas with Zod

This guide walks you through generating each GraphQL definition type using ZodQL, a pure Zod-based DSL for defining GraphQL schemas. ZodQL maps GraphQL grammar nodes directly to Zod schemas, providing type safety and runtime validation.

## Table of Contents

1. [Introduction](#introduction)
2. [Scalar Types](#scalar-types)
3. [Enum Types](#enum-types)
4. [Input Object Types](#input-object-types)
5. [Interface Types](#interface-types)
6. [Object Types](#object-types)
7. [Union Types](#union-types)
8. [Field Definitions with Arguments](#field-definitions-with-arguments)
9. [Root Operations](#root-operations)
10. [Schema Definition](#schema-definition)
11. [Resource Factory Pattern](#resource-factory-pattern)
12. [Complete Examples](#complete-examples)

---

## Introduction

ZodQL provides a type-safe way to define GraphQL schemas using Zod. The library maps GraphQL grammar nodes directly to Zod schemas:

| GraphQL Grammar | ZodQL Function | Zod Type |
|----------------|----------------|----------|
| `scalar` | `Scalars.X` | `z.string()`, `z.number()`, etc. |
| `enum` | `defineEnum` | `z.enum(...)` |
| `input` | `defineInput` | `z.object(...)` |
| `interface` | `defineInterface` | `z.object(...)` |
| `type` | `defineObject` | `z.object(...)` |
| `Field(args): Type` | `field(args, type)` | `{ args: ZodObject, returns: ZodType }` |
| `union` | `defineUnion` | `z.union(...)` |

### Basic Setup

```typescript
import { z } from 'zod';
import {
  Scalars,
  defineEnum,
  defineInput,
  defineInterface,
  defineObject,
  defineUnion,
  defineSchema,
  field,
  register,
  createResource,
} from './zodql/index.js';
```

---

## Scalar Types

**GraphQL Grammar:** `ScalarTypeDefinition`

Scalars are the leaf nodes of a GraphQL query. ZodQL provides built-in scalars that map to GraphQL's standard scalar types.

### Built-in Scalars

```typescript
import { Scalars } from './zodql/index.js';

// Standard GraphQL Scalars
const id: Scalars.ID;           // z.string() - Unique identifier
const string: Scalars.String;   // z.string() - UTF-8 character sequence
const int: Scalars.Int;         // z.number().int() - Signed 32-bit integer
const float: Scalars.Float;     // z.number() - Double-precision float
const boolean: Scalars.Boolean; // z.boolean() - true or false

// Custom Scalars (AWS AppSync)
const dateTime: Scalars.DateTime; // z.string().datetime() - ISO 8601 datetime
const json: Scalars.JSON;         // z.any() - Arbitrary JSON value
```

### Using Scalars in Schemas

```typescript
const UserSchema = z.object({
  id: Scalars.ID,
  name: Scalars.String,
  age: Scalars.Int,
  isActive: Scalars.Boolean,
  createdAt: Scalars.DateTime,
  metadata: Scalars.JSON,
});
```

### Custom Scalars

To create a custom scalar, use the `register` function:

```typescript
import { register } from './zodql/index.js';

// Custom scalar: Email
const Email = register('Email', z.string().email());

// Custom scalar: URL
const URL = register('URL', z.string().url());

// Use in schemas
const ContactSchema = z.object({
  email: Email,
  website: URL,
});
```

**Generated GraphQL:**
```graphql
scalar Email
scalar URL

type Contact {
  email: Email!
  website: URL!
}
```

---

## Enum Types

**GraphQL Grammar:** `EnumTypeDefinition`

Enums represent a fixed set of values. Use `defineEnum` to create an enum type.

### Basic Enum

```typescript
import { defineEnum } from './zodql/index.js';

// Define an enum
const UserRole = defineEnum('UserRole', ['ADMIN', 'USER', 'GUEST']);

// Use in schemas
const UserSchema = z.object({
  role: UserRole,
});
```

**Generated GraphQL:**
```graphql
enum UserRole {
  ADMIN
  USER
  GUEST
}

type User {
  role: UserRole!
}
```

### Enum with Descriptions

```typescript
// Enums can have descriptions via Zod's describe()
const Status = defineEnum('Status', ['ACTIVE', 'INACTIVE', 'PENDING'])
  .describe('Entity status');
```

### Using Enums in Input Types

```typescript
const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  role: UserRole, // Reference the enum
});
```

**Generated GraphQL:**
```graphql
input CreateUserInput {
  username: String!
  role: UserRole!
}
```

---

## Input Object Types

**GraphQL Grammar:** `InputObjectTypeDefinition`

Input types are used for mutation arguments and query parameters. They are pure data containers (no functions or computed fields).

### Basic Input Type

```typescript
import { defineInput } from './zodql/index.js';

const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  email: Scalars.String.email(),
  age: Scalars.Int.optional(),
  role: UserRole,
});
```

**Generated GraphQL:**
```graphql
input CreateUserInput {
  username: String!
  email: String!
  age: Int
  role: UserRole!
}
```

### Update Input Type (Partial Fields)

```typescript
// Update inputs typically allow partial updates
const UpdateUserInput = defineInput('UpdateUserInput', {
  username: Scalars.String.optional(),
  email: Scalars.String.email().optional(),
  age: Scalars.Int.optional(),
  role: UserRole.optional(),
});
```

### Nested Input Types

```typescript
const AddressInput = defineInput('AddressInput', {
  street: Scalars.String,
  city: Scalars.String,
  zipCode: Scalars.String,
});

const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  address: AddressInput, // Nested input
});
```

**Generated GraphQL:**
```graphql
input AddressInput {
  street: String!
  city: String!
  zipCode: String!
}

input CreateUserInput {
  username: String!
  address: AddressInput!
}
```

### Input Types with Default Values

```typescript
const CreatePostInput = defineInput('CreatePostInput', {
  title: Scalars.String,
  content: Scalars.String,
  published: Scalars.Boolean.default(false), // Default value
  tags: z.array(Scalars.String).default([]), // Default empty array
});
```

**Generated GraphQL:**
```graphql
input CreatePostInput {
  title: String!
  content: String!
  published: Boolean! = false
  tags: [String!]! = []
}
```

---

## Interface Types

**GraphQL Grammar:** `InterfaceTypeDefinition`

Interfaces define a contract that object types can implement. In ZodQL, interfaces are Zod objects that can be merged into other objects.

### Basic Interface

```typescript
import { defineInterface } from './zodql/index.js';

const Node = defineInterface('Node', {
  id: Scalars.ID,
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});
```

**Generated GraphQL:**
```graphql
interface Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Implementing Interfaces

```typescript
// Object types implement interfaces via the `implements` option
const User = defineObject('User', {
  implements: [Node], // Implements Node interface
  fields: {
    username: Scalars.String,
    email: Scalars.String,
  },
});
```

**Generated GraphQL:**
```graphql
type User implements Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
  username: String!
  email: String!
}
```

### Multiple Interface Implementation

```typescript
const Timestamped = defineInterface('Timestamped', {
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

const Owned = defineInterface('Owned', {
  ownerId: Scalars.ID,
});

const Post = defineObject('Post', {
  implements: [Timestamped, Owned], // Implements multiple interfaces
  fields: {
    title: Scalars.String,
    content: Scalars.String,
  },
});
```

**Generated GraphQL:**
```graphql
interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

interface Owned {
  ownerId: ID!
}

type Post implements Timestamped & Owned {
  createdAt: DateTime!
  updatedAt: DateTime!
  ownerId: ID!
  title: String!
  content: String!
}
```

### Interface Inheritance

```typescript
// Interfaces can extend other interfaces (via merging)
const Node = defineInterface('Node', {
  id: Scalars.ID,
});

const TimestampedNode = defineInterface('TimestampedNode', {
  ...Node.shape, // Extend Node interface
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});
```

---

## Object Types

**GraphQL Grammar:** `ObjectTypeDefinition`

Object types are the core building blocks of GraphQL schemas. They represent entities in your API.

### Basic Object Type

```typescript
import { defineObject } from './zodql/index.js';

const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
    email: Scalars.String,
    age: Scalars.Int.optional(),
  },
});
```

**Generated GraphQL:**
```graphql
type User {
  id: ID!
  username: String!
  email: String!
  age: Int
}
```

### Object Type with Optional Fields

```typescript
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
    email: Scalars.String.optional(), // Optional field
    bio: Scalars.String.optional(),
  },
});
```

**Generated GraphQL:**
```graphql
type User {
  id: ID!
  username: String!
  email: String
  bio: String
}
```

### Object Type with Lists

```typescript
const Post = defineObject('Post', {
  fields: {
    id: Scalars.ID,
    title: Scalars.String,
    tags: z.array(Scalars.String), // List of strings
    comments: z.array(Comment),     // List of objects
  },
});
```

**Generated GraphQL:**
```graphql
type Post {
  id: ID!
  title: String!
  tags: [String!]!
  comments: [Comment!]!
}
```

### Object Type with Nested Objects

```typescript
const Address = defineObject('Address', {
  fields: {
    street: Scalars.String,
    city: Scalars.String,
    zipCode: Scalars.String,
  },
});

const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
    address: Address, // Nested object
  },
});
```

### Object Type Implementing Interfaces

```typescript
const Node = defineInterface('Node', {
  id: Scalars.ID,
});

const User = defineObject('User', {
  implements: [Node], // Implements Node
  fields: {
    username: Scalars.String,
  },
});
```

### Extending Object Types

```typescript
// Base object
const BaseUser = defineObject('BaseUser', {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

// Extended object using Zod's extend()
const AdminUser = register('AdminUser', BaseUser.extend({
  permissions: z.array(Scalars.String),
}));
```

---

## Union Types

**GraphQL Grammar:** `UnionTypeDefinition`

Unions represent a value that can be one of several types. Use `defineUnion` to create union types.

### Basic Union

```typescript
import { defineUnion } from './zodql/index.js';

const Dog = defineObject('Dog', {
  fields: {
    name: Scalars.String,
    breed: Scalars.String,
  },
});

const Cat = defineObject('Cat', {
  fields: {
    name: Scalars.String,
    livesLeft: Scalars.Int,
  },
});

const Pet = defineUnion('Pet', [Dog, Cat]);
```

**Generated GraphQL:**
```graphql
type Dog {
  name: String!
  breed: String!
}

type Cat {
  name: String!
  livesLeft: Int!
}

union Pet = Dog | Cat
```

### Using Unions in Fields

```typescript
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    favoritePet: Pet, // Union type
  },
});
```

**Generated GraphQL:**
```graphql
type User {
  id: ID!
  favoritePet: Pet!
}
```

### Union with Multiple Types

```typescript
const Bird = defineObject('Bird', {
  fields: {
    name: Scalars.String,
    canFly: Scalars.Boolean,
  },
});

const Pet = defineUnion('Pet', [Dog, Cat, Bird]);
```

**Generated GraphQL:**
```graphql
union Pet = Dog | Cat | Bird
```

---

## Field Definitions with Arguments

**GraphQL Grammar:** `FieldDefinition` with `ArgumentsDefinition`

Fields can accept arguments. Use the `field` helper to define fields with arguments.

### Basic Field with Arguments

```typescript
import { field } from './zodql/index.js';

// Field: getUser(id: ID): User
const getUser = field(
  { id: Scalars.ID },  // Arguments
  User                 // Return type
);
```

**Generated GraphQL:**
```graphql
getUser(id: ID!): User!
```

### Field with Multiple Arguments

```typescript
// Field: searchUsers(query: String, limit: Int): [User]
const searchUsers = field(
  {
    query: Scalars.String,
    limit: Scalars.Int.optional(),
  },
  z.array(User)
);
```

**Generated GraphQL:**
```graphql
searchUsers(query: String!, limit: Int): [User!]!
```

### Field with Input Type Arguments

```typescript
const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  email: Scalars.String,
});

// Field: createUser(input: CreateUserInput): User
const createUser = field(
  { input: CreateUserInput },
  User
);
```

**Generated GraphQL:**
```graphql
createUser(input: CreateUserInput!): User!
```

### Field with Optional Arguments

```typescript
// Field: listPosts(filter: PostFilter, limit: Int): [Post]
const listPosts = field(
  {
    filter: PostFilter.optional(),
    limit: Scalars.Int.optional(),
  },
  z.array(Post)
);
```

**Generated GraphQL:**
```graphql
listPosts(filter: PostFilter, limit: Int): [Post!]!
```

### Field Return Types

```typescript
// Scalar return type
const getCount = field({}, Scalars.Int);

// Object return type
const getUser = field({ id: Scalars.ID }, User);

// List return type
const listUsers = field({}, z.array(User));

// Optional return type
const findUser = field({ id: Scalars.ID }, User.optional());

// Union return type
const getPet = field({ id: Scalars.ID }, Pet);
```

---

## Root Operations

**GraphQL Grammar:** `SchemaDefinition` with `RootOperationTypeDefinition`

Root operations (Query, Mutation, Subscription) are entry points to your GraphQL API.

### Query Operations

```typescript
import { defineObject } from './zodql/index.js';
import { field } from './zodql/index.js';

// Define query operations using field()
const queryOperations = {
  getUser: field({ id: Scalars.ID }, User),
  listUsers: field({}, z.array(User)),
  searchUsers: field(
    { query: Scalars.String },
    z.array(User)
  ),
};

// Convert to Zod object for defineObject
// Note: In actual generators, you'd extract args/returns differently
const Query = defineObject('Query', {
  fields: {
    // For now, we'll use the return types directly
    // A generator would handle the args/returns structure
    getUser: User,
    listUsers: z.array(User),
    searchUsers: z.array(User),
  },
});
```

**Generated GraphQL:**
```graphql
type Query {
  getUser(id: ID!): User!
  listUsers: [User!]!
  searchUsers(query: String!): [User!]!
}
```

### Mutation Operations

```typescript
const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  email: Scalars.String,
});

const UpdateUserInput = defineInput('UpdateUserInput', {
  id: Scalars.ID,
  username: Scalars.String.optional(),
  email: Scalars.String.optional(),
});

const mutationOperations = {
  createUser: field({ input: CreateUserInput }, User),
  updateUser: field({ input: UpdateUserInput }, User),
  deleteUser: field({ id: Scalars.ID }, Scalars.Boolean),
};

const Mutation = defineObject('Mutation', {
  fields: {
    createUser: User,
    updateUser: User,
    deleteUser: Scalars.Boolean,
  },
});
```

**Generated GraphQL:**
```graphql
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}
```

### Subscription Operations

```typescript
const subscriptionOperations = {
  onUserCreated: field({}, User),
  onUserUpdated: field({ id: Scalars.ID }, User),
  onUserDeleted: field({}, Scalars.Boolean),
};

const Subscription = defineObject('Subscription', {
  fields: {
    onUserCreated: User,
    onUserUpdated: User,
    onUserDeleted: Scalars.Boolean,
  },
});
```

**Generated GraphQL:**
```graphql
type Subscription {
  onUserCreated: User!
  onUserUpdated(id: ID!): User!
  onUserDeleted: Boolean!
}
```

---

## Schema Definition

**GraphQL Grammar:** `SchemaDefinition`

The schema definition ties together Query, Mutation, and Subscription types.

### Basic Schema

```typescript
import { defineSchema } from './zodql/index.js';

const schema = defineSchema({
  query: Query,
  mutation: Mutation,
  subscription: Subscription, // Optional
});
```

**Generated GraphQL:**
```graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}
```

### Schema with Query Only

```typescript
const schema = defineSchema({
  query: Query,
  // No mutation or subscription
});
```

**Generated GraphQL:**
```graphql
schema {
  query: Query
}
```

---

## Resource Factory Pattern

The resource factory pattern provides a standardized way to generate CRUD operations for entities. Use `createResource` to generate a complete suite of operations.

### Basic Resource

```typescript
import { createResource } from './zodql/index.js';

const PostResource = createResource('Post', {
  title: Scalars.String,
  content: Scalars.String,
  authorId: Scalars.ID,
});
```

This generates:
- **Entity Schema**: `Post` (with audit fields: `id`, `createdAt`, `updatedAt`)
- **Input Schemas**: `CreatePostInput`, `UpdatePostInput`
- **Query Operations**: `getPost`, `listPosts`
- **Mutation Operations**: `createPost`, `updatePost`, `deletePost`

### Using Resource Operations

```typescript
const PostResource = createResource('Post', {
  title: Scalars.String,
  content: Scalars.String,
});

// Access generated schemas
const Post = PostResource.Schemas.Entity;
const CreatePostInput = PostResource.Schemas.CreateInput;
const UpdatePostInput = PostResource.Schemas.UpdateInput;

// Access generated operations
const Query = defineObject('Query', {
  fields: {
    ...PostResource.ops.query, // getPost, listPosts
  },
});

const Mutation = defineObject('Mutation', {
  fields: {
    ...PostResource.ops.mutation, // createPost, updatePost, deletePost
  },
});
```

**Generated GraphQL:**
```graphql
type Post {
  id: ID!
  title: String!
  content: String!
  authorId: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
}

input CreatePostInput {
  title: String!
  content: String!
  authorId: ID!
}

input UpdatePostInput {
  id: ID!
  title: String
  content: String
  authorId: ID
}

type Query {
  getPost(id: ID!): Post!
  listPosts(limit: Int, filter: PostFilter): [Post!]!
}

type Mutation {
  createPost(input: CreatePostInput!): Post!
  updatePost(input: UpdatePostInput!): Post!
  deletePost(id: ID!): Boolean!
}
```

### Extending Resource Entities

```typescript
const PostResource = createResource('Post', {
  title: Scalars.String,
  content: Scalars.String,
});

// Extend the entity with additional fields
const ExtendedPost = register('Post', PostResource.Schemas.Entity.extend({
  viewCount: Scalars.Int,
  tags: z.array(Scalars.String),
}));
```

---

## Complete Examples

### Example 1: Blog API

```typescript
import { z } from 'zod';
import {
  Scalars,
  defineEnum,
  defineInput,
  defineInterface,
  defineObject,
  defineSchema,
  field,
  createResource,
} from './zodql/index.js';

// 1. Define Enums
const PostStatus = defineEnum('PostStatus', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);

// 2. Define Interfaces
const Node = defineInterface('Node', {
  id: Scalars.ID,
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

// 3. Define Input Types
const CreatePostInput = defineInput('CreatePostInput', {
  title: Scalars.String,
  content: Scalars.String,
  status: PostStatus,
});

// 4. Define Object Types
const User = defineObject('User', {
  implements: [Node],
  fields: {
    username: Scalars.String,
    email: Scalars.String,
  },
});

const Post = defineObject('Post', {
  implements: [Node],
  fields: {
    title: Scalars.String,
    content: Scalars.String,
    status: PostStatus,
    authorId: Scalars.ID,
  },
});

// 5. Define Query Operations
const Query = defineObject('Query', {
  fields: {
    getUser: field({ id: Scalars.ID }, User),
    getPost: field({ id: Scalars.ID }, Post),
    listPosts: field({}, z.array(Post)),
  },
});

// 6. Define Mutation Operations
const Mutation = defineObject('Mutation', {
  fields: {
    createPost: field({ input: CreatePostInput }, Post),
    updatePost: field({ input: UpdatePostInput }, Post),
  },
});

// 7. Define Schema
const schema = defineSchema({
  query: Query,
  mutation: Mutation,
});
```

### Example 2: Using Resource Factory

```typescript
import { z } from 'zod';
import {
  Scalars,
  defineEnum,
  defineObject,
  defineSchema,
  createResource,
} from './zodql/index.js';

// Define enum
const ProjectStatus = defineEnum('ProjectStatus', ['ACTIVE', 'INACTIVE']);

// Create resource
const ProjectResource = createResource('Project', {
  name: Scalars.String,
  description: Scalars.String,
  status: ProjectStatus,
});

// Extend with relationships
const ExtendedProject = register('Project', ProjectResource.Schemas.Entity.extend({
  docLinks: z.array(DocLink), // Relationship field
}));

// Use resource operations
const Query = defineObject('Query', {
  fields: {
    ...ProjectResource.ops.query,
  },
});

const Mutation = defineObject('Mutation', {
  fields: {
    ...ProjectResource.ops.mutation,
  },
});

const schema = defineSchema({
  query: Query,
  mutation: Mutation,
});
```

### Example 3: Complex Schema with Unions and Interfaces

```typescript
import { z } from 'zod';
import {
  Scalars,
  defineInterface,
  defineObject,
  defineUnion,
  defineSchema,
  field,
} from './zodql/index.js';

// Interfaces
const Node = defineInterface('Node', {
  id: Scalars.ID,
});

const Timestamped = defineInterface('Timestamped', {
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

// Object Types
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

// Union Type
const SearchResult = defineUnion('SearchResult', [User, Post]);

// Query with Union Return Type
const Query = defineObject('Query', {
  fields: {
    search: field(
      { query: Scalars.String },
      z.array(SearchResult)
    ),
  },
});

const schema = defineSchema({
  query: Query,
});
```

---

## Best Practices

### 1. Use Scalars for Standard Types

Always use `Scalars` for standard GraphQL types:

```typescript
// ✅ Good
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    name: Scalars.String,
  },
});

// ❌ Avoid
const User = defineObject('User', {
  fields: {
    id: z.string(), // Use Scalars.ID instead
    name: z.string(), // Use Scalars.String instead
  },
});
```

### 2. Register Custom Types

Always register custom types with `register`:

```typescript
// ✅ Good
const Email = register('Email', z.string().email());

// ❌ Avoid
const Email = z.string().email(); // Not registered, generator won't know the name
```

### 3. Use Resource Factory for CRUD

Use `createResource` for standard CRUD operations:

```typescript
// ✅ Good
const PostResource = createResource('Post', {
  title: Scalars.String,
  content: Scalars.String,
});

// ❌ Avoid (manual CRUD definition)
const Post = defineObject('Post', { /* ... */ });
const CreatePostInput = defineInput('CreatePostInput', { /* ... */ });
// ... etc
```

### 4. Extend Interfaces Properly

Use the `implements` option when defining objects:

```typescript
// ✅ Good
const User = defineObject('User', {
  implements: [Node],
  fields: { /* ... */ },
});

// ❌ Avoid (manual merging)
const User = register('User', Node.extend({ /* ... */ }));
```

### 5. Use Field Helper for Operations

Use `field()` helper for operations with arguments:

```typescript
// ✅ Good
const getUser = field({ id: Scalars.ID }, User);

// ❌ Avoid (manual structure)
const getUser = {
  args: z.object({ id: Scalars.ID }),
  returns: User,
};
```

---

## Integration with Generators

ZodQL is designed to work with GraphQL schema generators. The generator should:

1. **Read the Registry** to get type names for all registered schemas
2. **Traverse Zod schemas** to extract field definitions, types, and relationships
3. **Generate GraphQL SDL** from the Zod definitions
4. **Handle field operations** by extracting `args` and `returns` from `field()` results

### Generator Pattern

```typescript
import { Registry, getName } from './zodql/index.js';

// Get all registered types
for (const [schema, name] of Registry.entries()) {
  console.log(`Type: ${name}`);
  
  // Generate GraphQL from schema
  if (schema instanceof z.ZodObject) {
    // Generate object type
    generateObjectType(name, schema);
  } else if (schema instanceof z.ZodEnum) {
    // Generate enum type
    generateEnumType(name, schema);
  }
  // ... etc
}
```

---

## Summary

ZodQL provides a complete, type-safe way to define GraphQL schemas using Zod:

- **Scalars**: Use `Scalars.X` for standard types
- **Enums**: Use `defineEnum()` for fixed value sets
- **Inputs**: Use `defineInput()` for mutation/query arguments
- **Interfaces**: Use `defineInterface()` for shared contracts
- **Objects**: Use `defineObject()` for entity types
- **Unions**: Use `defineUnion()` for type alternatives
- **Fields**: Use `field()` for operations with arguments
- **Schema**: Use `defineSchema()` to tie everything together
- **Factory**: Use `createResource()` for standardized CRUD

All types are registered in the Registry, allowing generators to extract type names and generate GraphQL SDL automatically.

