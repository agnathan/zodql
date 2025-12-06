/**
 * =================================================================================
 * Plugin Usage Example
 * =================================================================================
 *
 * This file demonstrates how to use the ZodQL plugin system.
 * It shows how to register plugins and execute them with a generator.
 */

import { z } from 'zod';
import { defineObject, defineInput, field, Scalars } from '../../zodql/index.js';
import { GraphQLSchemaGenerator } from '../../generators/GraphQLSchemaGenerator.js';
import { PluginManager } from '../PluginManager.js';
import { GraphQLOperationsPlugin } from './GraphQLOperationsPlugin.js';

// Example: Define a User schema
const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  email: Scalars.String,
});

const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
    email: Scalars.String,
  },
});

// Create a generator
const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  inputs: {
    create: CreateUserInput,
  },
  queries: {
    getUser: field({ id: Scalars.ID }, User),
    listUsers: field({}, z.array(User)),
  },
  mutations: {
    createUser: field({ input: CreateUserInput }, User),
    updateUser: field({ id: Scalars.ID, input: CreateUserInput }, User),
  },
});

// Create plugin manager
const pluginManager = new PluginManager({
  workingDir: './generated',
  continueOnError: true,
});

// Register plugins
pluginManager.register(
  new GraphQLOperationsPlugin({
    outputDir: './generated/operations',
    format: 'typescript',
    generateTypes: true,
    generateDocuments: true,
  })
);

// Run plugins
async function generate() {
  const results = await pluginManager.runPlugins(generator);

  // Process results
  for (const result of results) {
    if (result.success) {
      console.log(`✓ ${result.plugin.name} completed in ${result.duration}ms`);
      if (result.output.logs) {
        result.output.logs.forEach((log) => console.log(`  ${log}`));
      }
      
      // Write files
      if (result.output.files) {
        for (const file of result.output.files) {
          console.log(`  Generated: ${file.path}`);
          // In a real implementation, you would write the file here
          // await fs.writeFile(file.path, file.content, 'utf8');
        }
      }
    } else {
      console.error(`✗ ${result.plugin.name} failed:`, result.error?.message);
      if (result.output.errors) {
        result.output.errors.forEach((error) => console.error(`  ${error}`));
      }
    }
  }
}

// Execute
generate().catch(console.error);
