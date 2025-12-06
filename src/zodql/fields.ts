import { z } from 'zod';

// Grammar Node: FieldDefinition
// Helper to define a field with arguments
export function field<
  Args extends z.ZodRawShape, 
  Return extends z.ZodTypeAny
>(
  args: Args, 
  returns: Return
) {
  // Maps to: Field(ArgumentsDefinition?): Type
  return z.function()
    .args(z.object(args))
    .returns(returns);
}

