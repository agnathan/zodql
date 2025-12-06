import { z } from 'zod';
import { register } from './registry.js';

// Grammar Node: ObjectTypeDefinition
export function defineObject<T extends z.ZodRawShape>(
  name: string, 
  config: {
    // Grammar: ImplementsInterfaces
    implements?: z.ZodObject<any>[]; 
    // Grammar: FieldsDefinition
    fields: T;
  }
) {
  let schema = z.object(config.fields);

  // If it implements interfaces, we merge them in (Mixin pattern)
  if (config.implements) {
    config.implements.forEach((iface) => {
      schema = iface.merge(schema) as any;
    });
  }

  return register(name, schema);
}

