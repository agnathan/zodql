#!/usr/bin/env tsx
import { lintGraphQLSchema, getDefaultLintRules } from '../src/validation/schema-linter.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * CLI script to lint a GraphQL schema file or string
 * 
 * Usage:
 *   tsx scripts/lint-schema.ts <schema-file-path>
 *   tsx scripts/lint-schema.ts --stdin  (reads from stdin)
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
    console.error('Usage: tsx scripts/lint-schema.ts <schema-file-path>');
    console.error('   or: tsx scripts/lint-schema.ts --stdin');
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

  console.log('🔍 Linting GraphQL schema...\n');

  const result = lintGraphQLSchema(schemaSDL, getDefaultLintRules());

  if (result.valid && result.warningCount === 0) {
    console.log('✅ Schema passes all linting rules!');
    process.exit(0);
  }

  // Group issues by severity
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');

  if (errors.length > 0) {
    console.error(`❌ Found ${errors.length} error(s):\n`);
    errors.forEach(issue => {
      const location = issue.location 
        ? ` (line ${issue.location.line}, column ${issue.location.column})`
        : '';
      console.error(`  [${issue.rule}] ${issue.message}${location}`);
    });
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  Found ${warnings.length} warning(s):\n`);
    warnings.forEach(issue => {
      const location = issue.location 
        ? ` (line ${issue.location.line}, column ${issue.location.column})`
        : '';
      console.log(`  [${issue.rule}] ${issue.message}${location}`);
    });
  }

  // Exit with error code if there are errors
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

