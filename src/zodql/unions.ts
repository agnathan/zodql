import { z } from 'zod';
import { register } from './registry.js';

// Grammar Node: UnionTypeDefinition
export function defineUnion(
  name: string, 
  types: [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
) {
  const schema = z.union(types);
  return register(name, schema);
}

