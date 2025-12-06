import { z } from 'zod';
import { register } from './registry.js';

// Grammar Node: InputObjectTypeDefinition
export function defineInput<T extends z.ZodRawShape>(
  name: string, 
  shape: T
) {
  const schema = z.object(shape);
  return register(name, schema);
}

