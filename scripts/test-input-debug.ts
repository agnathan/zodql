import { GraphQLSchemaGenerator } from '../src/generators/GraphQLSchemaGenerator.js';
import { Scalars, defineInput, defineObject, field, Registry } from '../src/zodql/index.js';
import { z } from 'zod';
import { validateGraphQLSchema } from '../src/validation/schema-validator.js';

Registry.clear();

console.log('=== Test: Input Types ===\n');
const CreateUserInput = defineInput('CreateUserInput', {
  username: Scalars.String,
  email: Scalars.String,
});

const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    username: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  inputs: {
    create: CreateUserInput,
  },
  mutations: {
    createUser: field({ input: CreateUserInput }, User),
  },
});

const schema = generator.generateSchemaFile();
console.log('Generated schema:');
console.log(schema);
console.log('\n');

const validation = validateGraphQLSchema(schema);
console.log('Validation:', validation.valid);
if (!validation.valid) {
  console.log('Errors:');
  validation.errors.forEach(err => console.log(`  - ${err}`));
}

