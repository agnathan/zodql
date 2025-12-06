import { z } from 'zod';

// Grammar Node: SchemaDefinition
export function defineSchema(roots: {
  query: z.ZodObject<any>;
  mutation?: z.ZodObject<any>;
  subscription?: z.ZodObject<any>;
}) {
  return roots;
}

