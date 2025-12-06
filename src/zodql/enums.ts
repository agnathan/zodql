import { z } from 'zod';
import { register } from './registry.js';

// Grammar Node: EnumTypeDefinition
export function defineEnum(name: string, values: [string, ...string[]]) {
  // z.enum requires a non-empty array
  const schema = z.enum(values);
  return register(name, schema);
}

