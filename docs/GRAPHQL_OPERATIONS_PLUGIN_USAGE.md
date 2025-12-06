# GraphQL Operations Plugin Usage Guide

## Overview

The `GraphQLOperationsPlugin` generates GraphQL operation documents (queries, mutations, subscriptions) and TypeScript types from your ZodQL schema.

## Basic Usage

### Step 1: Import Required Modules

```typescript
import { z } from 'zod';
import { defineObject, defineInput, field, Scalars } from 'zodql';
import { GraphQLSchemaGenerator } from 'zodql';
import { PluginManager } from 'zodql/plugins';
import { GraphQLOperationsPlugin } from 'zodql/src/plugins/examples/GraphQLOperationsPlugin.js';
```

### Step 2: Define Your ZodQL Schema

```typescript
// Define input types
const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  email: Scalars.String,
});

const UpdateUserInput = defineInput('UpdateUserInput', {
  username: Scalars.String.optional(),
  email: Scalars.String.optional(),
});

// Define your main entity
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
    email: Scalars.String,
    createdAt: Scalars.DateTime,
  },
});

// Create the generator with queries, mutations, and subscriptions
const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  inputs: {
    create: CreateUserInput,
    update: UpdateUserInput,
  },
  queries: {
    getUser: field({ id: Scalars.ID }, User),
    listUsers: field({ limit: Scalars.Int.optional() }, z.array(User)),
  },
  mutations: {
    createUser: field({ input: CreateUserInput }, User),
    updateUser: field({ id: Scalars.ID, input: UpdateUserInput }, User),
    deleteUser: field({ id: Scalars.ID }, Scalars.Boolean),
  },
  subscriptions: {
    userUpdated: field({ id: Scalars.ID }, User),
  },
});
```

### Step 3: Create Plugin Manager and Register Plugin

```typescript
const pluginManager = new PluginManager({
  workingDir: './generated',
  continueOnError: true,
});

pluginManager.register(
  new GraphQLOperationsPlugin({
    outputDir: './generated/operations',
    format: 'typescript',
    generateTypes: true,
    generateDocuments: true,
  })
);
```

### Step 4: Run Plugins and Write Files

```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

async function generateOperations() {
  const results = await pluginManager.runPlugins(generator);

  for (const result of results) {
    if (result.success && result.output.files) {
      for (const file of result.output.files) {
        // Create directory if it doesn't exist
        mkdirSync(dirname(file.path), { recursive: true });
        
        // Write the file
        writeFileSync(file.path, file.content, 'utf8');
        console.log(`✓ Generated: ${file.path}`);
      }
      
      // Log plugin output
      if (result.output.logs) {
        result.output.logs.forEach(log => console.log(`  ${log}`));
      }
    } else if (!result.success) {
      console.error(`✗ Plugin failed:`, result.error?.message);
      if (result.output.errors) {
        result.output.errors.forEach(error => console.error(`  ${error}`));
      }
    }
  }
}

generateOperations().catch(console.error);
```

## Complete Example

Here's a complete, runnable example:

```typescript
import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { defineObject, defineInput, field, Scalars } from 'zodql';
import { GraphQLSchemaGenerator } from 'zodql';
import { PluginManager } from 'zodql/plugins';
import { GraphQLOperationsPlugin } from 'zodql/src/plugins/examples/GraphQLOperationsPlugin.js';

// 1. Define your schema
const CreatePostInput = defineInput('CreatePostInput', {
  title: Scalars.String,
  content: Scalars.String,
  authorId: Scalars.ID,
});

const Post = defineObject('Post', {
  fields: {
    id: Scalars.ID,
    title: Scalars.String,
    content: Scalars.String,
    authorId: Scalars.ID,
    published: Scalars.Boolean,
  },
});

// 2. Create generator
const generator = new GraphQLSchemaGenerator('Post', {
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
    publishPost: field({ id: Scalars.ID }, Post),
  },
});

// 3. Setup plugin manager
const pluginManager = new PluginManager({
  workingDir: './generated',
});

pluginManager.register(
  new GraphQLOperationsPlugin({
    outputDir: './generated/operations',
    format: 'typescript',
    generateTypes: true,
    generateDocuments: true,
  })
);

// 4. Generate and write files
async function main() {
  const results = await pluginManager.runPlugins(generator);

  for (const result of results) {
    if (result.success && result.output.files) {
      for (const file of result.output.files) {
        mkdirSync(dirname(file.path), { recursive: true });
        writeFileSync(file.path, file.content, 'utf8');
        console.log(`✓ Generated: ${file.path}`);
      }
    }
  }
}

main().catch(console.error);
```

## Configuration Options

The `GraphQLOperationsPlugin` accepts the following options:

```typescript
interface GraphQLOperationsPluginOptions {
  /** Output directory for generated files (default: './generated') */
  outputDir?: string;
  
  /** Output format: 'typescript' or 'javascript' (default: 'typescript') */
  format?: 'typescript' | 'javascript';
  
  /** Whether to generate TypeScript types (default: true) */
  generateTypes?: boolean;
  
  /** Whether to generate operation documents (default: true) */
  generateDocuments?: boolean;
  
  /** Client library to generate for (default: 'vanilla') */
  client?: 'apollo' | 'urql' | 'react-query' | 'vanilla';
  
  /** File naming convention (not yet implemented) */
  fileNaming?: 'camelCase' | 'kebab-case' | 'PascalCase';
}
```

### Example Configurations

**Minimal Configuration:**
```typescript
new GraphQLOperationsPlugin()
// Uses all defaults: TypeScript, generates both types and documents
```

**JavaScript Output:**
```typescript
new GraphQLOperationsPlugin({
  format: 'javascript',
  generateTypes: false, // No TypeScript types for JS
})
```

**Custom Output Directory:**
```typescript
new GraphQLOperationsPlugin({
  outputDir: './src/graphql/generated',
})
```

**Only Types, No Documents:**
```typescript
new GraphQLOperationsPlugin({
  generateDocuments: false,
  generateTypes: true,
})
```

## Generated Output

The plugin generates two files:

### 1. `operations.ts` (or `operations.js`)

Contains GraphQL operation documents:

```graphql
query GetPost($id: ID!) {
  getPost(id: $id) {
    id
    title
    content
    authorId
    published
  }
}

mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    title
    content
    authorId
    published
  }
}
```

### 2. `operation-types.ts`

Contains TypeScript types for operations:

```typescript
export interface GetPostVariables {
  id: string;
}

export interface GetPostResponse {
  getPost: Post;
}

export interface CreatePostVariables {
  input: CreatePostInput;
}

export interface CreatePostResponse {
  createPost: Post;
}
```

## Using Generated Operations

### With Apollo Client

```typescript
import { gql, useQuery, useMutation } from '@apollo/client';
import { GetPostQuery, GetPostVariables } from './generated/operations/operation-types';
import { GET_POST } from './generated/operations/operations';

const GET_POST = gql`
  query GetPost($id: ID!) {
    getPost(id: $id) {
      id
      title
    }
  }
`;

function PostComponent({ postId }: { postId: string }) {
  const { data, loading } = useQuery<GetPostQuery, GetPostVariables>(GET_POST, {
    variables: { id: postId },
  });
  
  // ...
}
```

### With Fetch/vanilla JavaScript

```typescript
import { GetPostVariables, GetPostResponse } from './generated/operations/operation-types';

async function fetchPost(id: string) {
  const query = `
    query GetPost($id: ID!) {
      getPost(id: $id) {
        id
        title
        content
      }
    }
  `;
  
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { id } as GetPostVariables,
    }),
  });
  
  const result: { data: GetPostResponse } = await response.json();
  return result.data.getPost;
}
```

## Integration with Build Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "generate:operations": "tsx scripts/generate-operations.ts",
    "prebuild": "npm run generate:operations"
  }
}
```

Create `scripts/generate-operations.ts`:

```typescript
// Your plugin setup code here
```

## Troubleshooting

### Plugin Validation Fails

If you get "No operations found in schema":
- Make sure your generator has `queries`, `mutations`, or `subscriptions` defined
- Check that operations are properly defined using `field()`

### Files Not Generated

- Check that `outputDir` exists or is writable
- Verify plugin execution succeeded (check `result.success`)
- Ensure `generateDocuments` or `generateTypes` is `true`

### Type Errors

- Make sure all input types are registered with `defineInput()`
- Verify return types are registered with `defineObject()` or use `Registry.register()`

## Next Steps

- See `src/plugins/examples/usage-example.ts` for more examples
- Check `docs/PLUGIN_ECOSYSTEM.md` for plugin architecture details
- Explore other example plugins in `src/plugins/examples/`
