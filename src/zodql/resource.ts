import { z } from 'zod';
import { register } from './registry.js';
import { Scalars } from './scalars.js';

// Common "Audit" fields that every database entity usually has
const AuditFields = z.object({
  id: Scalars.ID,
  createdAt: Scalars.DateTime,
  updatedAt: Scalars.DateTime,
});

// Resource Factory Pattern
export function createResource<Shape extends z.ZodRawShape>(
  name: string, 
  baseShape: Shape
) {
  // 1. Define the Shapes
  const Base = z.object(baseShape);

  // Input: Create (Base shape as-is)
  const CreateInput = register(
    `Create${name}Input`, 
    Base
  );

  // Input: Update (Base shape partial + ID)
  const UpdateInput = register(
    `Update${name}Input`, 
    Base.partial().extend({ id: Scalars.ID })
  );

  // Output: The Full Entity (Base + Audit fields)
  // We use .merge() so it stays composable later
  const Entity = register(
    name, 
    Base.merge(AuditFields)
  );

  // 2. Define Standard CRUD Operations
  // We return these as definitions to be spread into the Root Query/Mutation
  
  const queryOps = {
    [`get${name}`]: z.function()
      .args(z.object({ id: Scalars.ID }))
      .returns(Entity),
      
    [`list${name}s`]: z.function()
      .args(z.object({ 
        limit: z.number().optional(),
        // Simple filter matching the base fields
        filter: Base.partial().optional() 
      }))
      .returns(z.array(Entity)),
  };

  const mutationOps = {
    [`create${name}`]: z.function()
      .args(z.object({ input: CreateInput }))
      .returns(Entity),

    [`update${name}`]: z.function()
      .args(z.object({ input: UpdateInput }))
      .returns(Entity),

    [`delete${name}`]: z.function()
      .args(z.object({ id: Scalars.ID }))
      .returns(z.boolean()),
  };

  return {
    name,
    // Schemas
    Schemas: {
      Base,
      Entity,
      CreateInput,
      UpdateInput,
    },
    // Operations
    ops: {
      query: queryOps,
      mutation: mutationOps
    }
  };
}

