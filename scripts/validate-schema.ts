#!/usr/bin/env tsx
import { validateGraphQLSchema } from '../src/validation/schema-validator.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * CLI script to validate a GraphQL schema file or string
 * 
 * Usage:
 *   tsx scripts/validate-schema.ts <schema-file-path>
 *   tsx scripts/validate-schema.ts --stdin  (reads from stdin)
 */
async function main() {
  const args = process.argv.slice(2);
  
  let schemaSDL: string;

  if (args.includes('--stdin')) {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    schemaSDL = Buffer.concat(chunks).toString('utf-8');
  } else if (args.length === 0) {
    console.error('❌ Error: Please provide a schema file path or use --stdin');
    console.error('Usage: tsx scripts/validate-schema.ts <schema-file-path>');
    console.error('   or: tsx scripts/validate-schema.ts --stdin');
    process.exit(1);
  } else {
    // Read from file
    const filePath = resolve(args[0]);
    try {
      schemaSDL = readFileSync(filePath, 'utf-8');
    } catch (error: any) {
      console.error(`❌ Error reading file "${filePath}":`, error.message);
      process.exit(1);
    }
  }

  if (!schemaSDL || schemaSDL.trim().length === 0) {
    console.error('❌ Error: Schema is empty');
    process.exit(1);
  }

  console.log('🔍 Validating GraphQL schema...\n');

  const result = validateGraphQLSchema(schemaSDL);

  if (result.valid) {
    console.log('✅ Schema is valid!');
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    process.exit(0);
  } else {
    console.error('❌ Schema validation failed:\n');
    result.errors.forEach(error => {
      console.error(`  - ${error}`);
    });
    if (result.warnings.length > 0) {
      console.error('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.error(`  - ${warning}`));
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

