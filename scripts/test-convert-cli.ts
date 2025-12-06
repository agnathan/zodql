import { convertGraphQLToZodQL } from '../src/cli/graphql-to-zodql.js';
import { existsSync } from 'fs';

// Test the convert function
process.argv = ['node', 'test', 'examples/test-schema.graphql', '-o', 'examples/test-output.ts'];

console.log('Starting conversion...');
console.log('Input file:', process.argv[2]);
console.log('Output file:', process.argv[4]);

try {
  convertGraphQLToZodQL();
  console.log('✓ Conversion function completed');
  
  if (existsSync('examples/test-output.ts')) {
    console.log('✓ Output file created successfully');
    const fs = require('fs');
    const content = fs.readFileSync('examples/test-output.ts', 'utf-8');
    console.log('File size:', content.length, 'characters');
    console.log('First 200 chars:', content.substring(0, 200));
  } else {
    console.log('✗ Output file was not created');
  }
} catch (error: any) {
  console.error('✗ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
