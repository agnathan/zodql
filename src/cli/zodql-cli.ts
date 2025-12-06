#!/usr/bin/env node
/**
 * =================================================================================
 * zodql-cli.ts
 * =================================================================================
 *
 * Main CLI entry point for ZodQL command-line tools.
 * Routes commands to appropriate subcommands.
 */

import { convertGraphQLToZodQL } from './graphql-to-zodql.js';
import { PluginCLI } from './plugin-cli.js';

const command = process.argv[2];
const args = process.argv.slice(3);

function printUsage() {
  console.log(`
ZodQL CLI - Command-line tools for ZodQL

Usage:
  zodql <command> [options]

Commands:
  convert <input-file>    Convert GraphQL schema to ZodQL code
  plugin <subcommand>     Manage and run ZodQL plugins

Examples:
  zodql convert schema.graphql
  zodql convert schema.graphql -o output.ts
  zodql plugin list
  zodql plugin run

Run 'zodql <command> --help' for more information on a command.
`);
}

function main() {
  if (!command || command === '-h' || command === '--help') {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'convert':
      // Call convert function directly with modified argv
      const originalArgv = [...process.argv];
      // Remove 'zodql' and 'convert' from argv, keep the rest
      process.argv = ['node', 'zodql', ...args];
      try {
        convertGraphQLToZodQL();
      } finally {
        process.argv = originalArgv;
      }
      break;

    case 'plugin':
      // Set up args for plugin command
      const pluginCLI = new PluginCLI();
      pluginCLI.run(args).catch((error) => {
        console.error('Error:', error.message);
        process.exit(1);
      });
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('zodql-cli.ts') ||
                     process.argv[1]?.endsWith('zodql-cli.js') ||
                     process.argv[0]?.includes('tsx') ||
                     process.argv[0]?.includes('node');

if (isMainModule) {
  main();
}
