import { z } from 'zod';
import { register } from './registry.js';

// Standard GraphQL Scalars
export const Scalars = {
  // Grammar: Int
  Int: z.number().int().describe('Int'),
  
  // Grammar: Float
  Float: z.number().describe('Float'),
  
  // Grammar: String
  String: z.string().describe('String'),
  
  // Grammar: Boolean
  Boolean: z.boolean().describe('Boolean'),
  
  // Grammar: ID
  ID: z.string().describe('ID'),
  
  // Grammar: Custom Scalar (e.g. DateTime)
  DateTime: register('DateTime', z.string().datetime()),
  
  // Grammar: Custom Scalar (e.g. JSON)
  JSON: register('JSON', z.any()),
};

