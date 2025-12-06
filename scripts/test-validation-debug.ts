import { GraphQLSchemaGenerator } from '../src/generators/GraphQLSchemaGenerator.js';
import { Scalars, defineEnum, defineInput, defineObject, field, Registry } from '../src/zodql/index.js';
import { z } from 'zod';
import { validateGraphQLSchema } from '../src/validation/schema-validator.js';

Registry.clear();

console.log('=== Test: Enums ===\n');
const UserRole = defineEnum('UserRole', ['ADMIN', 'USER', 'GUEST']);
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    role: UserRole,
  },
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  queries: {
    getUser: field({ id: Scalars.ID }, User),
  },
});

const schema = generator.generateSchemaFile();
console.log('Generated schema:');
console.log(schema);
console.log('\n');
console.log('Registry entries:', Array.from(Registry.entries()).map(([s, n]) => `${n} (${s.constructor.name})`));
console.log('\n');

const validation = validateGraphQLSchema(schema);
console.log('Validation:', validation.valid);
if (!validation.valid) {
  console.log('Errors:');
  validation.errors.forEach(err => console.log(`  - ${err}`));
}

