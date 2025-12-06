
## GraphQL Grammar
Based on the official [GraphQL Specification (October 2021)](https://spec.graphql.org/), here is the formal grammar of GraphQL represented in **EBNF (Extended Backus-Naur Form)**.

It is divided into two main parts:
1.  **Executable Grammar:** Used for writing Queries and Mutations.
2.  **Schema Grammar (SDL):** Used for defining the Type System (which you are currently generating with Zod).

***

### Notation Key
*   `?` : Optional (0 or 1)
*   `*` : Zero or more
*   `+` : One or more
*   `|` : Alternative (OR)
*   `"text"` : Literal string

---

### 1. The Document (Root)
Every GraphQL file or request is a `Document`.

```ebnf
Document            ::= Definition+

Definition          ::= ExecutableDefinition
                      | TypeSystemDefinition
                      | TypeSystemExtension

ExecutableDefinition ::= OperationDefinition
                       | FragmentDefinition
```

---

### 2. Operations (Queries & Mutations)
This is the grammar used when **sending requests** to the server.

```ebnf
OperationDefinition ::= OperationType Name? VariableDefinitions? Directives? SelectionSet
                      | SelectionSet  /* Short-hand query */

OperationType       ::= "query" | "mutation" | "subscription"

SelectionSet        ::= "{" Selection+ "}"

Selection           ::= Field
                      | FragmentSpread
                      | InlineFragment

Field               ::= Alias? Name Arguments? Directives? SelectionSet?

Alias               ::= Name ":"

Arguments           ::= "(" Argument+ ")"

Argument            ::= Name ":" Value
```

#### Fragments
Reusable units of logic within operations.

```ebnf
FragmentDefinition  ::= "fragment" FragmentName TypeCondition Directives? SelectionSet

FragmentSpread      ::= "..." FragmentName Directives?

InlineFragment      ::= "..." TypeCondition? Directives? SelectionSet

TypeCondition       ::= "on" NamedType
```

#### Values
The data types used as inputs in arguments or defaults.

```ebnf
Value               ::= Variable
                      | IntValue
                      | FloatValue
                      | StringValue
                      | BooleanValue
                      | NullValue
                      | EnumValue
                      | ListValue
                      | ObjectValue

ListValue           ::= "[" Value* "]"

ObjectValue         ::= "{" ObjectField* "}"

ObjectField         ::= Name ":" Value

Variable            ::= "$" Name
```

---

### 3. Schema Definition Language (SDL)
This is the grammar used to **define your API** (what you are building with Zod).

```ebnf
TypeSystemDefinition ::= SchemaDefinition
                       | TypeDefinition
                       | DirectiveDefinition

SchemaDefinition     ::= Description? "schema" Directives? "{" RootOperationTypeDefinition+ "}"

RootOperationTypeDefinition ::= OperationType ":" NamedType
```

#### Type Definitions
The core types we discussed earlier.

```ebnf
TypeDefinition       ::= ScalarTypeDefinition
                       | ObjectTypeDefinition
                       | InterfaceTypeDefinition
                       | UnionTypeDefinition
                       | EnumTypeDefinition
                       | InputObjectTypeDefinition

/* 1. Scalar */
ScalarTypeDefinition ::= Description? "scalar" Name Directives?

/* 2. Object */
ObjectTypeDefinition ::= Description? "type" Name ImplementsInterfaces? Directives? FieldsDefinition?

ImplementsInterfaces ::= "implements" "&"? NamedType ("&" NamedType)*

FieldsDefinition     ::= "{" FieldDefinition+ "}"

FieldDefinition      ::= Description? Name ArgumentsDefinition? ":" Type Directives?

ArgumentsDefinition  ::= "(" InputValueDefinition+ ")"

InputValueDefinition ::= Description? Name ":" Type DefaultValue? Directives?

/* 3. Interface */
InterfaceTypeDefinition ::= Description? "interface" Name ImplementsInterfaces? Directives? FieldsDefinition?

/* 4. Union */
UnionTypeDefinition  ::= Description? "union" Name Directives? UnionMemberTypes?

UnionMemberTypes     ::= "=" "|"? NamedType ("|" NamedType)*

/* 5. Enum */
EnumTypeDefinition   ::= Description? "enum" Name Directives? EnumValuesDefinition?

EnumValuesDefinition ::= "{" EnumValueDefinition+ "}"

EnumValueDefinition  ::= Description? EnumValue Directives?

/* 6. Input Object */
InputObjectTypeDefinition ::= Description? "input" Name Directives? InputFieldsDefinition?

InputFieldsDefinition ::= "{" InputValueDefinition+ "}"
```

---

### 4. Type References
How types are referenced (e.g., `String`, `[String]`, `String!`).

```ebnf
Type                ::= NamedType
                      | ListType
                      | NonNullType

NamedType           ::= Name

ListType            ::= "[" Type "]"

NonNullType         ::= NamedType "!"
                      | ListType "!"
```

---

### Summary of Terminology for your Zod Generator

If you are building a generator, these are the grammar nodes you need to account for:

1.  **`ObjectTypeDefinition`**: Maps to `z.object({})`.
2.  **`FieldDefinition`**: Maps to the properties inside the Zod object.
3.  **`InputValueDefinition`**: Maps to the arguments inside `z.function().args(...)` or properties inside an Input Object.
4.  **`NonNullType`**: The default in your logic (unless `z.optional()` is used).
5.  **`ListType`**: Maps to `z.array()`.




## TypeScript ZodQL
To step through the GraphQL grammar and map it to ZodJS, we need to build a small library of **Constructor Functions**.

These functions will act as your "Schema Definition Language" (SDL) in TypeScript. They will take definitions (names, fields, arguments) and output pure **Zod Schemas** that contain the metadata needed for your generator.

Here is the implementation mapped directly to the grammar nodes.

### 1. The Registry (State)
GraphQL requires named types (`NamedType` in grammar). Zod schemas are anonymous by default. We need a registry to link a Zod instance to a GraphQL name.

```typescript
import { z } from 'zod';

// Global registry to map Zod Schemas -> GraphQL Names
export const Registry = new Map<z.ZodTypeAny, string>();

const register = <T extends z.ZodTypeAny>(name: string, schema: T): T => {
  Registry.set(schema, name);
  return schema;
};
```

---

### 2. Scalar Definitions
**Grammar Node:** `ScalarTypeDefinition`
GraphQL has built-in scalars. We map these to specific Zod primitives.

```typescript
export const Scalars = {
  // Grammar: Int
  Int: z.number().int().describe('Int'),
  
  // Grammar: Float
  Float: z.number().describe('Float'),
  
  // Grammar: String
  String: z.string().describe('String'),
  
  // Grammar: Boolean
  Boolean: z.boolean().describe('Boolean'),
  
  // Grammar: ID
  ID: z.string().describe('ID'),
  
  // Grammar: Custom Scalar (e.g. Date)
  Date: register('Date', z.string().datetime())
};
```

---

### 3. Enum Definitions
**Grammar Node:** `EnumTypeDefinition`
Maps a GraphQL Enum to a Zod Native Enum.

```typescript
export function defineEnum(name: string, values: [string, ...string[]]) {
  // z.enum requires a non-empty array
  const schema = z.enum(values);
  return register(name, schema);
}
```

---

### 4. Input Object Definitions
**Grammar Node:** `InputObjectTypeDefinition`
Inputs are structurally different from Types because they cannot contain functions (arguments). They are pure data containers.

```typescript
export function defineInput<T extends z.ZodRawShape>(
  name: string, 
  shape: T
) {
  const schema = z.object(shape);
  return register(name, schema);
}
```

---

### 5. Interface Definitions
**Grammar Node:** `InterfaceTypeDefinition`
Zod doesn't have "Interfaces", but it has "Objects". To simulate a GraphQL Interface, we create a Zod object that is intended to be `.merge()`'d into other objects.

```typescript
export function defineInterface<T extends z.ZodRawShape>(
  name: string, 
  shape: T
) {
  const schema = z.object(shape);
  return register(name, schema);
}
```

---

### 6. Field Definitions (The Core Logic)
**Grammar Node:** `FieldDefinition`
This is where the magic happens. A field in a GraphQL Object can be:
1.  **Simple Data:** `name: String`
2.  **A Function with Args:** `posts(limit: Int): [Post]`

We need a helper to create the `z.function()` structure we discussed earlier.

```typescript
// Helper to define a field with arguments
export function field<
  Args extends z.ZodRawShape, 
  Return extends z.ZodTypeAny
>(
  args: Args, 
  returns: Return
) {
  // Maps to: Field(ArgumentsDefinition?): Type
  return z.function()
    .args(z.object(args))
    .returns(returns);
}
```

---

### 7. Object Type Definitions
**Grammar Node:** `ObjectTypeDefinition`
This maps to `z.object`. It needs to handle "ImplementsInterfaces" by merging those shapes into the final object.

```typescript
export function defineObject<T extends z.ZodRawShape>(
  name: string, 
  config: {
    // Grammar: ImplementsInterfaces
    implements?: z.ZodObject<any>[]; 
    // Grammar: FieldsDefinition
    fields: T;
  }
) {
  let schema = z.object(config.fields);

  // If it implements interfaces, we merge them in (Mixin pattern)
  if (config.implements) {
    config.implements.forEach((iface) => {
      schema = iface.merge(schema) as any;
    });
  }

  return register(name, schema);
}
```

---

### 8. Union Definitions
**Grammar Node:** `UnionTypeDefinition`
Maps to `z.union`.

```typescript
export function defineUnion(
  name: string, 
  types: [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
) {
  const schema = z.union(types);
  return register(name, schema);
}
```

---

### 9. Root Operations
**Grammar Node:** `SchemaDefinition`
We define the schema by creating the specific root objects.

```typescript
export function defineSchema(roots: {
  query: z.ZodObject<any>;
  mutation?: z.ZodObject<any>;
  subscription?: z.ZodObject<any>;
}) {
  return roots;
}
```

---

### Putting it all together: A Usage Example

Here is how you use these functions to represent a valid GraphQL schema using your new Zod DSL.

```typescript
// -------------------------------------------------------------
// 1. Define Enum
// -------------------------------------------------------------
const Role = defineEnum('Role', ['ADMIN', 'USER', 'GUEST']);

// -------------------------------------------------------------
// 2. Define Interface
// -------------------------------------------------------------
const Node = defineInterface('Node', {
  id: Scalars.ID
});

// -------------------------------------------------------------
// 3. Define Input
// -------------------------------------------------------------
const CreateUserIdx = defineInput('CreateUserInput', {
  username: Scalars.String,
  role: Role // Reference the Enum
});

// -------------------------------------------------------------
// 4. Define Object (Implementing Interface)
// -------------------------------------------------------------
const User = defineObject('User', {
  implements: [Node], // Implements Node
  fields: {
    // Scalar fields
    username: Scalars.String,
    email: Scalars.String.email(), // Using Zod refinement
    role: Role,
    
    // Field with Arguments (z.function)
    // greet(greeting: String): String
    greet: field(
      { greeting: Scalars.String.optional() }, 
      Scalars.String
    )
  }
});

// -------------------------------------------------------------
// 5. Define Root Query
// -------------------------------------------------------------
const Query = defineObject('Query', {
  fields: {
    // getUser(id: ID): User
    getUser: field(
      { id: Scalars.ID },
      User
    ),
    // listUsers: [User]
    listUsers: z.array(User)
  }
});

// -------------------------------------------------------------
// 6. Define Root Mutation
// -------------------------------------------------------------
const Mutation = defineObject('Mutation', {
  fields: {
    // createUser(input: CreateUserInput): User
    createUser: field(
      { input: CreateUserIdx },
      User
    )
  }
});

// -------------------------------------------------------------
// 7. Final Schema Package
// -------------------------------------------------------------
export const mySchema = defineSchema({
  query: Query,
  mutation: Mutation
});

// Check the Registry to see it worked
console.log('Registry Entries:', Registry.size); 
// Should contain Role, Node, CreateUserInput, User, Query, Mutation
```

### Summary of the Mapping

| GraphQL Grammar | Your Zod Function | Resulting Zod Type |
| :--- | :--- | :--- |
| `scalar` | `Scalars.X` | `z.string()`, `z.number()`, etc. |
| `enum` | `defineEnum` | `z.nativeEnum(...)` |
| `input` | `defineInput` | `z.object(...)` |
| `interface` | `defineInterface` | `z.object(...)` |
| `type` | `defineObject` | `z.object(...)` (Merged with interfaces) |
| `Field(args): Type` | `field(args, type)` | `z.function().args(...).returns(...)` |
| `union` | `defineUnion` | `z.union(...)` |


## Factories and Putting it all Together to Create a GraphQL Project definition

To achieve this, we can implement a **Resource Factory Pattern**.

Instead of manually defining the Type, Input, Query, and Mutation for every single entity, you define a **Base Definition** (the "DNA" of the entity). You then pass this into a factory function that creates a standardized "bundle" containing:

1.  **The Object Type** (with ID + Timestamps added)
2.  **The Inputs** (Create, Update, Filter)
3.  **The Operations** (CRUD)

Here is a complete, composable implementation using the Pure Zod approach we established.

### 1. The Setup (Helpers)
First, let's bring in the necessary Zod tools and a Mock Registry to ensure our types get named.

```typescript
import { z } from 'zod';

// --- 1. Infrastructure ---

// A simple registry to keep track of named types (from previous steps)
const Registry = new Map<z.ZodTypeAny, string>();
const register = <T extends z.ZodTypeAny>(name: string, schema: T): T => {
  Registry.set(schema, name);
  return schema;
};

// Standard Scalars
const ID = z.string().uuid();
const DateTime = z.string().datetime();

// Common "Audit" fields that every database entity usually has
const AuditFields = z.object({
  id: ID,
  createdAt: DateTime,
  updatedAt: DateTime,
});
```

### 2. The Resource Factory
This is the core engine. It takes a name and a "Base Shape" and generates an entire suite of GraphQL definitions.

```typescript
// --- 2. The Resource Factory ---

export function createResource<Shape extends z.ZodRawShape>(
  name: string, 
  baseShape: Shape
) {
  // 1. Define the Shapes
  const Base = z.object(baseShape);

  // Input: Create (Base shape as-is)
  const CreateInput = register(
    `Create${name}Input`, 
    Base
  );

  // Input: Update (Base shape partial + ID)
  const UpdateInput = register(
    `Update${name}Input`, 
    Base.partial().extend({ id: ID })
  );

  // Output: The Full Entity (Base + Audit fields)
  // We use .merge() so it stays composable later
  const Entity = register(
    name, 
    Base.merge(AuditFields)
  );

  // 2. Define Standard CRUD Operations
  // We return these as definitions to be spread into the Root Query/Mutation
  
  const queryOps = {
    [`get${name}`]: z.function()
      .args(z.object({ id: ID }))
      .returns(Entity),
      
    [`list${name}s`]: z.function()
      .args(z.object({ 
        limit: z.number().optional(),
        // Simple filter matching the base fields
        filter: Base.partial().optional() 
      }))
      .returns(z.array(Entity)),
  };

  const mutationOps = {
    [`create${name}`]: z.function()
      .args(z.object({ input: CreateInput }))
      .returns(Entity),

    [`update${name}`]: z.function()
      .args(z.object({ input: UpdateInput }))
      .returns(Entity),

    [`delete${name}`]: z.function()
      .args(z.object({ id: ID }))
      .returns(z.boolean()),
  };

  return {
    name,
    // Schemas
    Schemas: {
      Base,
      Entity,
      CreateInput,
      UpdateInput,
    },
    // Operations
    ops: {
      query: queryOps,
      mutation: mutationOps
    }
  };
}
```

### 3. Usage: Defining "DocLink" and "Project"
Now we can implement your specific example.

```typescript
// --- 3. Define Dependent Resources First ---

// Let's say a Project has DocLinks. We define DocLink first.
const DocLinkResource = createResource('DocLink', {
  url: z.string().url(),
  label: z.string(),
});

// --- 4. Define the Main Resource (Project) ---

// Define the Enum
const ProjectStatus = register(
  'ProjectStatus', 
  z.enum(['ACTIVE', 'INACTIVE'])
);

// Define the Project Resource
const ProjectResource = createResource('Project', {
  name: z.string().min(1),
  description: z.string(),
  status: ProjectStatus, // Using the Enum
});

// --- 5. Composition / Extension ---

// Requirement: Project "has many" DocLinks.
// We can extend the standard Entity generated by the factory.

// 1. Create the relation field
const ProjectRelations = z.object({
  docLinks: z.array(DocLinkResource.Schemas.Entity)
});

// 2. Overwrite the registry entry with the Extended version.
//    (In a real app, you might use an 'extend' helper, but this works for pure Zod)
const FullProjectEntity = register(
  'Project', // Re-registering 'Project'
  ProjectResource.Schemas.Entity.merge(ProjectRelations)
);

// Update the resource reference so queries use the new extended type
ProjectResource.Schemas.Entity = FullProjectEntity;
```

### 4. Assembling the Schema
Finally, we weave the generated operations into the main Root definitions.

```typescript
// --- 6. Assemble the Schema ---

const Query = z.object({
  // Spread in DocLink Queries (getDocLink, listDocLinks)
  ...DocLinkResource.ops.query,
  
  // Spread in Project Queries (getProject, listProjects)
  ...ProjectResource.ops.query,
  
  // Add custom query
  dashboardStats: z.function().returns(z.object({ totalProjects: z.number() }))
});

const Mutation = z.object({
  // Spread in Mutations
  ...DocLinkResource.ops.mutation,
  ...ProjectResource.ops.mutation,
});

// --- 7. Output Verification ---

console.log("--- Generated Registry ---");
// You will see: CreateProjectInput, UpdateProjectInput, ProjectStatus, Project, etc.
console.log([...Registry.values()]);

console.log("\n--- Generated Query Type ---");
// This demonstrates that the factory successfully created the method signatures
for(const [key, val] of Object.entries(Query.shape)) {
  console.log(`Field: ${key}`); 
}
```

### How this meets your needs:

1.  **Factory Set:** The `createResource` function acts as your standardized factory. It guarantees every entity has `createdAt`, `updatedAt`, `id`, and consistent naming (`CreateXInput`).
2.  **Grouping:** Inputs, Enums, and Objects are grouped inside the `ProjectResource` variable.
3.  **Composability:** We defined `ProjectStatus` separately and passed it in.
4.  **Extensibility (Has Many):** We took the `ProjectResource.Schemas.Entity`, used standard Zod `.merge()`, and added the `docLinks` array. Because Zod is structural, this works perfectly.
5.  **Pure Zod:** No external libraries were used, just Zod objects and functions.