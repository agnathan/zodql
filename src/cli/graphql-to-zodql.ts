#!/usr/bin/env node
/**
 * =================================================================================
 * graphql-to-zodql.ts
 * =================================================================================
 *
 * Command-line tool to convert GraphQL Schema Definition Language (SDL) files
 * to ZodQL TypeScript code.
 *
 * Usage:
 *   zodql convert <input-file> [options]
 *   zodql convert <input-file> -o <output-file>
 *   zodql convert <input-file> --output <output-file>
 *   zodql convert <input-file> --no-imports
 *
 * Options:
 *   -o, --output <file>    Output file path (default: stdout or <input>.zodql.ts)
 *   --no-imports           Don't include import statements
 *   --entity-name <name>   Default entity name for generator (default: auto-detect)
 *   -h, --help            Show help message
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { ZodQLCodeGenerator, type ZodQLCodeGeneratorOptions } from '../generators/ZodQLCodeGenerator.js';

interface CLIOptions {
  input: string;
  output?: string;
  includeImports: boolean;
  entityName?: string;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    printHelp();
    process.exit(0);
  }

  const options: CLIOptions = {
    input: '',
    includeImports: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-o' || arg === '--output') {
      if (i + 1 < args.length) {
        options.output = args[++i];
      } else {
        console.error('Error: --output requires a file path');
        process.exit(1);
      }
    } else if (arg === '--no-imports') {
      options.includeImports = false;
    } else if (arg === '--entity-name') {
      if (i + 1 < args.length) {
        options.entityName = args[++i];
      } else {
        console.error('Error: --entity-name requires a name');
        process.exit(1);
      }
    } else if (!arg.startsWith('-')) {
      // First non-flag argument is the input file
      if (!options.input) {
        options.input = arg;
      }
    }
  }

  if (!options.input) {
    console.error('Error: Input file is required');
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp() {
  console.log(`
GraphQL to ZodQL Converter

Usage:
  zodql convert <input-file> [options]
  zodql convert <input-file> -o <output-file>

Options:
  -o, --output <file>      Output file path (default: stdout)
  --no-imports             Don't include import statements
  --entity-name <name>     Default entity name for generator (default: auto-detect)
  -h, --help              Show this help message

Examples:
  zodql convert schema.graphql
  zodql convert schema.graphql -o schema.zodql.ts
  zodql convert schema.graphql --no-imports
  zodql convert schema.graphql --entity-name User
`);
}

function readGraphQLSchema(filePath: string): string {
  try {
    const resolvedPath = resolve(filePath);
    return readFileSync(resolvedPath, 'utf-8');
  } catch (error: any) {
    console.error(`Error reading file "${filePath}": ${error.message}`);
    process.exit(1);
  }
}

function writeOutput(content: string, outputPath?: string) {
  if (outputPath) {
    try {
      const resolvedPath = resolve(outputPath);
      // Ensure output directory exists
      const outputDir = dirname(resolvedPath);
      if (outputDir !== '.' && outputDir !== process.cwd()) {
        mkdirSync(outputDir, { recursive: true });
      }
      writeFileSync(resolvedPath, content, 'utf-8');
      console.log(`✓ Generated ZodQL code written to: ${resolvedPath}`);
    } catch (error: any) {
      console.error(`Error writing file "${outputPath}": ${error.message}`);
      process.exit(1);
    }
  } else {
    // Write to stdout
    console.log(content);
  }
}

function generateOutputFileName(inputPath: string): string {
  const baseName = basename(inputPath, extname(inputPath));
  const dir = dirname(inputPath);
  const outputPath = resolve(dir, `${baseName}.zodql.ts`);
  return outputPath;
}

function main() {
  try {
    const options = parseArgs();
    
    // Read GraphQL schema
    const graphQLSchema = readGraphQLSchema(options.input);
    
    if (!graphQLSchema.trim()) {
      console.error('Error: Input file is empty');
      process.exit(1);
    }

    // Configure generator
    const generatorOptions: ZodQLCodeGeneratorOptions = {
      includeImports: options.includeImports,
      defaultEntityName: options.entityName,
    };

    // Generate ZodQL code
    const generator = new ZodQLCodeGenerator(generatorOptions);
    const zodqlCode = generator.generateZodQLCode(graphQLSchema);

    if (!zodqlCode.trim()) {
      console.error('Warning: Generated ZodQL code is empty');
      process.exit(1);
    }

    // Write output
    // If output is explicitly specified, always write to file
    // Otherwise, write to stdout if in TTY, or auto-generate filename
    if (options.output !== undefined) {
      // Explicit output file specified
      writeOutput(zodqlCode, options.output);
    } else if (process.stdout.isTTY) {
      // No output specified and running in terminal - write to stdout
      writeOutput(zodqlCode);
    } else {
      // No output specified and not in terminal - auto-generate filename
      const outputPath = generateOutputFileName(options.input);
      writeOutput(zodqlCode, outputPath);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('graphql-to-zodql.ts') ||
                     process.argv[1]?.endsWith('graphql-to-zodql.js') ||
                     process.argv[0]?.includes('tsx') ||
                     process.argv[0]?.includes('node');

if (isMainModule && !process.argv[2]?.startsWith('convert')) {
  // Only auto-run if not being called from zodql-cli.ts
  main();
}

export { main as convertGraphQLToZodQL };
