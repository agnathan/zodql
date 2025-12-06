#!/usr/bin/env node
/**
 * =================================================================================
 * generate-operations.ts
 * =================================================================================
 *
 * Script to generate GraphQL operations from a ZodQL schema using the
 * GraphQL Operations Plugin.
 *
 * Usage:
 *   tsx scripts/generate-operations.ts [schema-file]
 *
 * If no schema file is provided, it will look for:
 *   - schema.ts
 *   - schema.zodql.ts
 *   - output.ts (generated ZodQL file)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { pathToFileURL } from 'url';
import { PluginManager } from '../src/plugins/PluginManager.js';
import { GraphQLOperationsPlugin } from '../src/plugins/examples/GraphQLOperationsPlugin.js';
import type { GraphQLSchemaGenerator } from '../src/generators/GraphQLSchemaGenerator.js';

// Default schema file paths to try
const DEFAULT_SCHEMA_PATHS = [
  // './schema.ts',
  // './schema.zodql.ts',
  './output.ts',
];

/**
 * Find and load the schema file
 */
async function loadSchema(schemaPath?: string): Promise<{ generator: GraphQLSchemaGenerator }> {
  let resolvedPath: string | undefined;

  if (schemaPath) {
    resolvedPath = resolve(schemaPath);
    if (!existsSync(resolvedPath)) {
      console.error(`❌ Schema file not found: ${resolvedPath}`);
      process.exit(1);
    }
  } else {
    // Try default paths
    for (const path of DEFAULT_SCHEMA_PATHS) {
      const fullPath = resolve(path);
      if (existsSync(fullPath)) {
        resolvedPath = fullPath;
        break;
      }
    }

    if (!resolvedPath) {
      console.error('❌ No schema file found. Please specify one:');
      console.error('   tsx scripts/generate-operations.ts <schema-file>');
      console.error('\nOr create one of these files:');
      DEFAULT_SCHEMA_PATHS.forEach(path => console.error(`   - ${path}`));
      process.exit(1);
    }
  }

  console.log(`📄 Loading schema from: ${resolvedPath}`);

  try {
    // Dynamic import of the schema file
    // Always use file:// URL for absolute paths to ensure correct resolution
    // Relative paths in ESM are resolved relative to the importing module, not cwd
    const importPath = pathToFileURL(resolvedPath).href;
    
    const schemaModule = await import(importPath);
    
    // Look for exported generator in various formats
    let generator = schemaModule.generator || 
                   schemaModule.default?.generator || 
                   schemaModule.default ||
                   (schemaModule as any).generator;
    
    // If still not found, try accessing from module exports
    if (!generator && typeof schemaModule === 'object') {
      const keys = Object.keys(schemaModule);
      for (const key of keys) {
        const value = (schemaModule as any)[key];
        if (value && typeof value === 'object' && 'generateSchemaFile' in value) {
          generator = value;
          break;
        }
      }
    }
    
    if (!generator) {
      console.error('❌ Schema file must export a generator.');
      console.error('\nPlease add this to your schema file:');
      console.error('   export const generator = new GraphQLSchemaGenerator(...);');
      console.error('\nOr if the generator is already defined, add:');
      console.error('   export { generator };');
      process.exit(1);
    }

    return { generator };
  } catch (error: any) {
    console.error(`❌ Error loading schema file: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Generate GraphQL operations using the plugin
 */
async function generateOperations() {
  // Get schema path from command line args
  const schemaPath = process.argv[2];

  // Load schema
  const { generator } = await loadSchema(schemaPath);

  console.log(`\n🚀 Generating GraphQL operations...\n`);

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
  let successCount = 0;
  let fileCount = 0;

  for (const result of results) {
    if (result.success) {
      successCount++;
      console.log(`✓ ${result.plugin.name} completed in ${result.duration}ms`);
      
      if (result.output.files && result.output.files.length > 0) {
        for (const file of result.output.files) {
          try {
            // Create directory if needed
            const fileDir = dirname(file.path);
            if (fileDir !== '.' && fileDir !== process.cwd()) {
              mkdirSync(fileDir, { recursive: true });
            }
            
            // Write file
            writeFileSync(file.path, file.content, 'utf-8');
            console.log(`  📝 Generated: ${file.path}`);
            fileCount++;
          } catch (error: any) {
            console.error(`  ✗ Error writing ${file.path}: ${error.message}`);
          }
        }
      }
      
      // Log plugin messages
      if (result.output.logs && result.output.logs.length > 0) {
        result.output.logs.forEach(log => console.log(`  ℹ️  ${log}`));
      }
    } else {
      console.error(`✗ ${result.plugin.name} failed:`, result.error?.message);
      if (result.output.errors && result.output.errors.length > 0) {
        result.output.errors.forEach(error => console.error(`  ✗ ${error}`));
      }
    }
  }

  console.log(`\n✅ Generation complete!`);
  console.log(`   ${successCount} plugin(s) executed successfully`);
  console.log(`   ${fileCount} file(s) generated\n`);
}

// Run the script
generateOperations().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
