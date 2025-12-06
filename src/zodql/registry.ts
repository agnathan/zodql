import { z } from 'zod';

// Global registry to map Zod Schemas -> GraphQL Names
export const Registry = new Map<z.ZodTypeAny, string>();

export const register = <T extends z.ZodTypeAny>(name: string, schema: T): T => {
  Registry.set(schema, name);
  return schema;
};

