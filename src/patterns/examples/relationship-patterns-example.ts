/**
 * =================================================================================
 * Relationship Patterns Usage Example (String-based API)
 * =================================================================================
 *
 * Demonstrates the original string-based API for relationship patterns.
 * For type-safe usage, see relationship-patterns-example-typed.ts
 *
 * NOTE: This example uses strings for pattern names and relationship types.
 * For better type safety and autocomplete, use the typed API shown in
 * relationship-patterns-example-typed.ts
 */

import { z } from 'zod';
import { defineObject, Scalars, defineRelationship } from '../../zodql/index.js';
import { GraphQLSchemaGenerator, GeneratorConfig } from '../../generators/GraphQLSchemaGenerator.js';
import {
  PatternManager,
  forwardConnectionPattern,
  rootLevelFilterPattern,
  backReferenceOnlyPattern,
} from '../index.js';

// =============================================================================
// Example 1: Forward Connection Pattern
// =============================================================================

export function exampleForwardConnection() {
  // Define base types
  const Project = defineObject('Project', {
    fields: {
      id: Scalars.ID,
      name: Scalars.String,
    },
  });

  const Dashboard = defineObject('Dashboard', {
    fields: {
      id: Scalars.ID,
      title: Scalars.String,
    },
  });

  // Define relationship with forward-connection pattern
  defineRelationship(Project, 'hasMany', Dashboard, {
    pattern: 'forward-connection',
    fieldName: 'dashboards',
    includeCount: true,
  });

  // Create generator with pattern manager
  const patternManager = new PatternManager({
    defaultPattern: 'forward-connection',
    patterns: new Map([
      ['forward-connection', forwardConnectionPattern],
    ]),
  });

  const config: GeneratorConfig = {
    schema: Project,
    queries: {
      project: z.function().args(z.object({ id: Scalars.ID })).returns(Project),
    },
  };

  const generator = new GraphQLSchemaGenerator('Project', config, {
    applyPatterns: true,
    patternManager: {
      defaultPattern: 'forward-connection',
      patterns: new Map([
        ['forward-connection', forwardConnectionPattern],
      ]),
    },
  });

  const schema = generator.generateSchemaFile();
  console.log('=== Forward Connection Pattern ===');
  console.log(schema);
}

// =============================================================================
// Example 2: Root-Level Filter Pattern
// =============================================================================

export function exampleRootLevelFilter() {
  // Define base types
  const Project = defineObject('Project', {
    fields: {
      id: Scalars.ID,
      name: Scalars.String,
    },
  });

  const Dashboard = defineObject('Dashboard', {
    fields: {
      id: Scalars.ID,
      title: Scalars.String,
    },
  });

  // Define relationship with root-level-filter pattern
  defineRelationship(Project, 'hasMany', Dashboard, {
    pattern: 'root-level-filter',
    fieldName: 'dashboards',
    includeCount: true,
  });

  const config: GeneratorConfig = {
    schema: Project,
    queries: {
      project: z.function().args(z.object({ id: Scalars.ID })).returns(Project),
    },
  };

  const generator = new GraphQLSchemaGenerator('Project', config, {
    applyPatterns: true,
    patternManager: {
      defaultPattern: 'root-level-filter',
      patterns: new Map([
        ['root-level-filter', rootLevelFilterPattern],
        ['forward-connection', forwardConnectionPattern],
      ]),
    },
  });

  const schema = generator.generateSchemaFile();
  console.log('=== Root-Level Filter Pattern ===');
  console.log(schema);
}

// =============================================================================
// Example 3: Back-Reference Only Pattern
// =============================================================================

export function exampleBackReferenceOnly() {
  // Define base types
  const Project = defineObject('Project', {
    fields: {
      id: Scalars.ID,
      name: Scalars.String,
    },
  });

  const Dashboard = defineObject('Dashboard', {
    fields: {
      id: Scalars.ID,
      title: Scalars.String,
    },
  });

  // Define relationship with back-reference-only pattern
  defineRelationship(Project, 'hasMany', Dashboard, {
    pattern: 'back-reference-only',
    fieldName: 'dashboards',
  });

  const config: GeneratorConfig = {
    schema: Project,
    queries: {
      project: z.function().args(z.object({ id: Scalars.ID })).returns(Project),
    },
  };

  const generator = new GraphQLSchemaGenerator('Project', config, {
    applyPatterns: true,
    patternManager: {
      defaultPattern: 'back-reference-only',
      patterns: new Map([
        ['back-reference-only', backReferenceOnlyPattern],
      ]),
    },
  });

  const schema = generator.generateSchemaFile();
  console.log('=== Back-Reference Only Pattern ===');
  console.log(schema);
}

// =============================================================================
// Example 4: Multiple Relationships with Different Patterns
// =============================================================================

export function exampleMultipleRelationships() {
  const Project = defineObject('Project', {
    fields: {
      id: Scalars.ID,
      name: Scalars.String,
    },
  });

  const Dashboard = defineObject('Dashboard', {
    fields: {
      id: Scalars.ID,
      title: Scalars.String,
    },
  });

  const User = defineObject('User', {
    fields: {
      id: Scalars.ID,
      email: Scalars.String,
    },
  });

  // Project has many Dashboards (forward connection)
  defineRelationship(Project, 'hasMany', Dashboard, {
    pattern: 'forward-connection',
    fieldName: 'dashboards',
    includeCount: true,
  });

  // Project belongs to User (back-reference only)
  defineRelationship(Project, 'belongsTo', User, {
    pattern: 'back-reference-only',
    backReferenceFieldName: 'owner',
  });

  const config: GeneratorConfig = {
    schema: Project,
    queries: {
      project: z.function().args(z.object({ id: Scalars.ID })).returns(Project),
    },
  };

  const generator = new GraphQLSchemaGenerator('Project', config, {
    applyPatterns: true,
    patternManager: {
      defaultPattern: 'forward-connection',
      patterns: new Map([
        ['forward-connection', forwardConnectionPattern],
        ['back-reference-only', backReferenceOnlyPattern],
      ]),
    },
  });

  const schema = generator.generateSchemaFile();
  console.log('=== Multiple Relationships ===');
  console.log(schema);
}

