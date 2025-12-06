import { GraphQLSchemaGenerator } from '../src/generators/GraphQLSchemaGenerator.js';
import { Scalars, defineEnum, defineInput, defineObject, defineInterface, defineUnion, field, Registry } from '../src/zodql/index.js';
import { z } from 'zod';
import { validateGraphQLSchema } from '../src/validation/schema-validator.js';
import { lintGraphQLSchema } from '../src/validation/schema-linter.js';

Registry.clear();

console.log('=== Test: Complex Schema with Unions and Interfaces ===\n');

const Node = defineInterface('Node', {
  id: Scalars.ID,
});

const Timestamped = defineInterface('Timestamped', {
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

const User = defineObject('User', {
  implements: [Node, Timestamped],
  fields: {
    username: Scalars.String,
  },
});

const Post = defineObject('Post', {
  implements: [Node, Timestamped],
  fields: {
    title: Scalars.String,
  },
});

const SearchResult = defineUnion('SearchResult', [User, Post]);

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  queries: {
    search: field({ query: Scalars.String }, z.array(SearchResult)),
  },
});

const schema = generator.generateSchemaFile();
console.log('Generated schema:');
console.log(schema);
console.log('\n');
console.log('Registry entries:', Array.from(Registry.entries()).map(([s, n]) => n));
console.log('\n');

const validation = validateGraphQLSchema(schema);
console.log('Validation:', validation.valid);
if (!validation.valid) {
  console.log('Errors:');
  validation.errors.forEach(err => console.log(`  - ${err}`));
}

const linting = lintGraphQLSchema(schema);
console.log('\nLinting errors:', linting.errorCount);
if (linting.errorCount > 0) {
  linting.issues.filter(i => i.severity === 'error').forEach(issue => {
    console.log(`  - [${issue.rule}] ${issue.message}`);
  });
}
console.log('\n');

