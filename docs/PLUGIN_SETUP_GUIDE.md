# GraphQL Operations Plugin Setup Guide

This guide explains how to add and run the GraphQL Operations Plugin on your ZodQL schema.

## Overview

The GraphQL Operations Plugin generates GraphQL operation documents (queries, mutations, subscriptions) and TypeScript types from your ZodQL schema definitions.

## Prerequisites

- A ZodQL schema file (TypeScript file with ZodQL definitions)
- Node.js and npm installed
- ZodQL package installed

## Method 1: Programmatic Usage (Recommended)

This is the most flexible approach - create a script that loads your ZodQL schema and runs the plugin.

### Step 1: Create Your ZodQL Schema File

Create a file `schema.ts` (or `schema.zodql.ts`) with your ZodQL definitions:

```typescript
// schema.ts
import { z } from 'zod';
import { defineObject, defineInput, field, Scalars } from 'zodql';
import { GraphQLSchemaGenerator } from 'zodql';

// Define input types
const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  email: Scalars.String,
  age: Scalars.Int.optional(),
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
    age: Scalars.Int.optional(),
    createdAt: Scalars.DateTime,
  },
});

// Create the generator
export const generator = new GraphQLSchemaGenerator('User', {
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

### Step 2: Create a Generation Script

Create `scripts/generate-operations.ts`:

```typescript
// scripts/generate-operations.ts
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { PluginManager } from '../src/plugins/PluginManager.js';
import { GraphQLOperationsPlugin } from '../src/plugins/examples/GraphQLOperationsPlugin.js';
import { generator } from '../schema.js'; // Import your generator

async function generateOperations() {
  // Create plugin manager
  const pluginManager = new PluginManager({
    workingDir: './generated',
    continueOnError: true,
  });

  // Register the GraphQL Operations Plugin
  pluginManager.register(
    new GraphQLOperationsPlugin({
      outputDir: './generated/operations',
      format: 'typescript',
      generateTypes: true,
      generateDocuments: true,
    })
  );

  // Run plugins
  const results = await pluginManager.runPlugins(generator);

  // Write generated files
  for (const result of results) {
    if (result.success) {
      console.log(`✓ ${result.plugin.metadata.name} completed in ${result.duration}ms`);
      
      if (result.output.files) {
        for (const file of result.output.files) {
          // Create directory if needed
          mkdirSync(dirname(file.path), { recursive: true });
          
          // Write file
          writeFileSync(file.path, file.content, 'utf-8');
          console.log(`  Generated: ${file.path}`);
        }
      }
      
      // Log plugin messages
      if (result.output.logs) {
        result.output.logs.forEach(log => console.log(`  ${log}`));
      }
    } else {
      console.error(`✗ ${result.plugin.metadata.name} failed:`, result.error?.message);
      if (result.output.errors) {
        result.output.errors.forEach(error => console.error(`  ${error}`));
      }
    }
  }
}

generateOperations().catch(console.error);
```

### Step 3: Add npm Script

Add to your `package.json`:

```json
{
  "scripts": {
    "generate:operations": "tsx scripts/generate-operations.ts"
  }
}
```

### Step 4: Run the Script

```bash
npm run generate:operations
```

This will generate:
- `generated/operations/operations.ts` - GraphQL operation documents
- `generated/operations/operation-types.ts` - TypeScript types

## Method 2: Using the CLI (Configuration-Based)

This method uses the `zodql plugin` CLI with a configuration file.

### Step 1: Initialize Plugin Configuration

```bash
zodql plugin init
```

This creates `zodql.config.json`:

```json
{
  "plugins": [],
  "workingDir": "./generated",
  "continueOnError": true,
  "parallel": false
}
```

### Step 2: Add the GraphQL Operations Plugin

**Option A: Using the built-in plugin (if available as npm package)**

```bash
zodql plugin add zodql-plugin-operations --outputDir ./generated/operations --format typescript
```

**Option B: Using local plugin file**

Edit `zodql.config.json` manually:

```json
{
  "plugins": [
    {
      "name": "./src/plugins/examples/GraphQLOperationsPlugin.ts",
      "options": {
        "outputDir": "./generated/operations",
        "format": "typescript",
        "generateTypes": true,
        "generateDocuments": true
      }
    }
  ],
  "workingDir": "./generated",
  "continueOnError": true,
  "parallel": false
}
```

**Note:** The CLI currently expects plugins to work with a generator. You'll need to create a script that:
1. Loads your ZodQL schema
2. Creates a GraphQLSchemaGenerator
3. Runs the plugin CLI or PluginManager

### Step 3: Create a Runner Script

Since the CLI needs a generator instance, create `scripts/run-plugins.ts`:

```typescript
// scripts/run-plugins.ts
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { readFileSync } from 'fs';
import { PluginManager } from '../src/plugins/PluginManager.js';
import { GraphQLOperationsPlugin } from '../src/plugins/examples/GraphQLOperationsPlugin.js';
import { generator } from '../schema.js'; // Your generator

// Load plugin config
const config = JSON.parse(readFileSync('zodql.config.json', 'utf-8'));

const pluginManager = new PluginManager({
  workingDir: config.workingDir || './generated',
  continueOnError: config.continueOnError ?? true,
  parallel: config.parallel ?? false,
});

// Register plugins from config
for (const pluginConfig of config.plugins || []) {
  if (pluginConfig.name.includes('GraphQLOperationsPlugin')) {
    pluginManager.register(
      new GraphQLOperationsPlugin(pluginConfig.options || {})
    );
  }
  // Add other plugin types here
}

// Run plugins
async function run() {
  const results = await pluginManager.runPlugins(generator);
  
  for (const result of results) {
    if (result.success && result.output.files) {
      for (const file of result.output.files) {
        mkdirSync(dirname(file.path), { recursive: true });
        writeFileSync(file.path, file.content, 'utf-8');
        console.log(`✓ Generated: ${file.path}`);
      }
    }
  }
}

run().catch(console.error);
```

Then run:

```bash
tsx scripts/run-plugins.ts
```

## Complete Example: Full Workflow

Here's a complete example that combines everything:

### File Structure

```
project/
├── schema.ts                 # Your ZodQL schema
├── scripts/
│   └── generate-operations.ts # Generation script
├── package.json
└── zodql.config.json         # Plugin config (optional)
```

### schema.ts

```typescript
import { z } from 'zod';
import { defineObject, defineInput, field, Scalars } from 'zodql';
import { GraphQLSchemaGenerator } from 'zodql';

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
    createdAt: Scalars.DateTime,
  },
});

export const generator = new GraphQLSchemaGenerator('Post', {
  schema: Post,
  inputs: {
    create: CreatePostInput,
  },
  queries: {
    getPost: field({ id: Scalars.ID }, Post),
    listPosts: field({ limit: Scalars.Int.optional() }, z.array(Post)),
  },
  mutations: {
    createPost: field({ input: CreatePostInput }, Post),
    publishPost: field({ id: Scalars.ID }, Post),
    deletePost: field({ id: Scalars.ID }, Scalars.Boolean),
  },
});
```

### scripts/generate-operations.ts

```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { PluginManager } from '../src/plugins/PluginManager.js';
import { GraphQLOperationsPlugin } from '../src/plugins/examples/GraphQLOperationsPlugin.js';
import { generator } from '../schema.js';

async function main() {
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

  const results = await pluginManager.runPlugins(generator);

  for (const result of results) {
    if (result.success && result.output.files) {
      for (const file of result.output.files) {
        mkdirSync(dirname(file.path), { recursive: true });
        writeFileSync(file.path, file.content, 'utf-8');
        console.log(`✓ Generated: ${file.path}`);
      }
      if (result.output.logs) {
        result.output.logs.forEach(log => console.log(`  ${log}`));
      }
    } else if (!result.success) {
      console.error(`✗ Failed:`, result.error?.message);
    }
  }
}

main().catch(console.error);
```

### package.json

```json
{
  "scripts": {
    "generate": "tsx scripts/generate-operations.ts"
  }
}
```

### Run

```bash
npm run generate
```

## Plugin Options

The `GraphQLOperationsPlugin` accepts these options:

```typescript
{
  outputDir?: string;           // Output directory (default: './generated')
  format?: 'typescript' | 'javascript';  // Output format (default: 'typescript')
  generateTypes?: boolean;      // Generate TypeScript types (default: true)
  generateDocuments?: boolean;  // Generate operation documents (default: true)
  client?: 'apollo' | 'urql' | 'react-query' | 'vanilla';  // Client library (default: 'vanilla')
  fileNaming?: 'camelCase' | 'kebab-case' | 'PascalCase';  // File naming (not yet implemented)
}
```

## Generated Output

After running, you'll get:

### `generated/operations/operations.ts`

```typescript
/**
 * Generated GraphQL Operations
 * This file is auto-generated. Do not edit manually.
 */

query GetPost($id: ID!) {
  getPost(id: $id) {
    id
    title
    content
    authorId
    published
    createdAt
  }
}

mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    title
    content
    authorId
    published
    createdAt
  }
}
```

### `generated/operations/operation-types.ts`

```typescript
/**
 * Generated TypeScript Types for GraphQL Operations
 * This file is auto-generated. Do not edit manually.
 */

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

## Troubleshooting

### "No operations found in schema"

- Ensure your generator has `queries`, `mutations`, or `subscriptions` defined
- Check that operations use the `field()` helper correctly

### Files not generated

- Verify `outputDir` is writable
- Check that `generateDocuments` or `generateTypes` is `true`
- Ensure plugin execution succeeded (check console output)

### Import errors

- Make sure you're importing from the correct paths
- For local development, use relative paths: `'../src/plugins/examples/GraphQLOperationsPlugin.js'`
- For published packages, use: `'zodql-plugin-operations'` (when available)

## Next Steps

- See `docs/GRAPHQL_OPERATIONS_PLUGIN_USAGE.md` for detailed plugin usage
- Check `src/plugins/examples/usage-example.ts` for more examples
- Explore other plugins in `src/plugins/examples/`
