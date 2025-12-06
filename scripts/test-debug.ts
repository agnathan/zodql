import { z } from 'zod';
import { GraphQLSchemaGenerator } from '../src/generators/GraphQLSchemaGenerator.js';
import {
  Scalars,
  defineEnum,
  defineInput,
  Registry,
} from '../src/zodql/index.js';

// Clear registry
Registry.clear();

// Test: Enum generation
console.log('=== TEST: Enum Generation ===\n');

const UserRole = defineEnum('UserRole', ['ADMIN', 'USER', 'GUEST']);
const UserSchema = z.object({
  id: Scalars.ID,
  role: UserRole,
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: UserSchema,
});

const schema = generator.generateSchemaFile();

console.log('INPUT:');
console.log('UserRole = defineEnum("UserRole", ["ADMIN", "USER", "GUEST"])');
console.log('UserSchema = z.object({ id: Scalars.ID, role: UserRole })');
console.log('\nOUTPUT:');
console.log(schema);
console.log('\n' + '='.repeat(50) + '\n');

// Test: Input types
console.log('=== TEST: Input Types ===\n');

Registry.clear();

const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  email: Scalars.String,
});

const generator2 = new GraphQLSchemaGenerator('User', {
  schema: z.object({ id: Scalars.ID }),
});

const schema2 = generator2.generateSchemaFile();

console.log('INPUT:');
console.log('CreateUserInput = defineInput("CreateUserInput", { username, email })');
console.log('Generator with schema: z.object({ id: Scalars.ID })');
console.log('\nOUTPUT:');
console.log(schema2);
console.log('\n' + '='.repeat(50) + '\n');

