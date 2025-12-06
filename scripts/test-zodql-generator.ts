import { ZodQLCodeGenerator } from '../src/generators/ZodQLCodeGenerator.js';

const graphQLSchema = `
type User {
  id: ID!
  username: String!
  email: String
  age: Int
}

type Query {
  getUser(id: ID!): User!
  listUsers: [User!]!
}
`;

const generator = new ZodQLCodeGenerator({ includeImports: true });
const zodqlCode = generator.generateZodQLCode(graphQLSchema);

console.log('Generated ZodQL Code:');
console.log('='.repeat(60));
console.log(zodqlCode);
console.log('='.repeat(60));
