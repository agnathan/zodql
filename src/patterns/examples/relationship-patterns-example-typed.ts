/**
 * =================================================================================
 * Type-Safe Relationship Patterns Usage Example
 * =================================================================================
 *
 * Demonstrates type-safe usage of relationship patterns using TypeScript
 * best practices: const objects, string literal types, and fluent APIs.
 */

import { z } from 'zod';
import {
  defineObject,
  Scalars,
  defineRelationship,
  relationship,
  RelationshipTypes,
} from '../../zodql/index.js';
import { GraphQLSchemaGenerator, GeneratorConfig } from '../../generators/GraphQLSchemaGenerator.js';
import {
  PatternManager,
  createPatternManager,
  PatternNames,
  forwardConnectionPattern,
  rootLevelFilterPattern,
  backReferenceOnlyPattern,
} from '../index.js';

// =============================================================================
// Example 1: Forward Connection Pattern (Type-Safe)
// =============================================================================

export function exampleForwardConnectionTyped() {
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

  // Option 1: Using defineRelationship with constants (type-safe)
  defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
    pattern: PatternNames.ForwardConnection,
    fieldName: 'dashboards',
    includeCount: true,
  });

  // Option 2: Using fluent builder API (more type-safe and readable)
  relationship(Project, RelationshipTypes.HasMany, Dashboard)
    .withPattern(PatternNames.ForwardConnection)
    .withFieldName('dashboards')
    .withCount()
    .build();

  // Create type-safe pattern manager
  const patternManager = createPatternManager()
    .withDefaultPattern(PatternNames.ForwardConnection)
    .withBuiltInPatterns()
    .build();

  const config: GeneratorConfig = {
    schema: Project,
    queries: {
      project: z.function().args(z.object({ id: Scalars.ID })).returns(Project),
    },
  };

  const generator = new GraphQLSchemaGenerator('Project', config, {
    applyPatterns: true,
    patternManager: {
      defaultPattern: PatternNames.ForwardConnection,
      patterns: new Map([
        [PatternNames.ForwardConnection, forwardConnectionPattern],
      ]),
    },
  });

  const schema = generator.generateSchemaFile();
  console.log('=== Forward Connection Pattern (Type-Safe) ===');
  console.log(schema);
}

// =============================================================================
// Example 2: Root-Level Filter Pattern (Type-Safe)
// =============================================================================

export function exampleRootLevelFilterTyped() {
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

  // Using fluent builder API
  relationship(Project, RelationshipTypes.HasMany, Dashboard)
    .withPattern(PatternNames.RootLevelFilter)
    .withFieldName('dashboards')
    .withCount()
    .build();

  const config: GeneratorConfig = {
    schema: Project,
    queries: {
      project: z.function().args(z.object({ id: Scalars.ID })).returns(Project),
    },
  };

  const generator = new GraphQLSchemaGenerator('Project', config, {
    applyPatterns: true,
    patternManager: {
      defaultPattern: PatternNames.RootLevelFilter,
      patterns: new Map([
        [PatternNames.RootLevelFilter, rootLevelFilterPattern],
        [PatternNames.ForwardConnection, forwardConnectionPattern],
      ]),
    },
  });

  const schema = generator.generateSchemaFile();
  console.log('=== Root-Level Filter Pattern (Type-Safe) ===');
  console.log(schema);
}

// =============================================================================
// Example 3: Back-Reference Only Pattern (Type-Safe)
// =============================================================================

export function exampleBackReferenceOnlyTyped() {
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

  // Using fluent builder API
  relationship(Project, RelationshipTypes.HasMany, Dashboard)
    .withPattern(PatternNames.BackReferenceOnly)
    .withFieldName('dashboards')
    .build();

  const config: GeneratorConfig = {
    schema: Project,
    queries: {
      project: z.function().args(z.object({ id: Scalars.ID })).returns(Project),
    },
  };

  const generator = new GraphQLSchemaGenerator('Project', config, {
    applyPatterns: true,
    patternManager: {
      defaultPattern: PatternNames.BackReferenceOnly,
      patterns: new Map([
        [PatternNames.BackReferenceOnly, backReferenceOnlyPattern],
      ]),
    },
  });

  const schema = generator.generateSchemaFile();
  console.log('=== Back-Reference Only Pattern (Type-Safe) ===');
  console.log(schema);
}

// =============================================================================
// Example 4: Multiple Relationships with Different Patterns (Type-Safe)
// =============================================================================

export function exampleMultipleRelationshipsTyped() {
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
  relationship(Project, RelationshipTypes.HasMany, Dashboard)
    .withPattern(PatternNames.ForwardConnection)
    .withFieldName('dashboards')
    .withCount()
    .build();

  // Project belongs to User (back-reference only)
  relationship(Project, RelationshipTypes.BelongsTo, User)
    .withPattern(PatternNames.BackReferenceOnly)
    .withBackReferenceFieldName('owner')
    .build();

  const config: GeneratorConfig = {
    schema: Project,
    queries: {
      project: z.function().args(z.object({ id: Scalars.ID })).returns(Project),
    },
  };

  // Create pattern manager with all built-in patterns
  const patternManager = createPatternManager()
    .withDefaultPattern(PatternNames.ForwardConnection)
    .withBuiltInPatterns()
    .build();

  const generator = new GraphQLSchemaGenerator('Project', config, {
    applyPatterns: true,
    patternManager: {
      defaultPattern: PatternNames.ForwardConnection,
      patterns: new Map([
        [PatternNames.ForwardConnection, forwardConnectionPattern],
        [PatternNames.BackReferenceOnly, backReferenceOnlyPattern],
      ]),
    },
  });

  const schema = generator.generateSchemaFile();
  console.log('=== Multiple Relationships (Type-Safe) ===');
  console.log(schema);
}

// =============================================================================
// Example 5: Advanced Usage with Custom Metadata
// =============================================================================

export function exampleAdvancedTyped() {
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

  // Using fluent API with custom metadata and pattern options
  relationship(Project, RelationshipTypes.HasMany, Dashboard)
    .withPattern(PatternNames.ForwardConnection)
    .withFieldName('dashboards')
    .withBackReferenceFieldName('project')
    .withCount()
    .withMetadata({
      description: 'Project dashboards',
      resolverHint: 'useDataLoader',
    })
    .withPatternOptions({
      maxPageSize: 100,
    })
    .build();

  const config: GeneratorConfig = {
    schema: Project,
    queries: {
      project: z.function().args(z.object({ id: Scalars.ID })).returns(Project),
    },
  };

  const generator = new GraphQLSchemaGenerator('Project', config, {
    applyPatterns: true,
    patternManager: {
      defaultPattern: PatternNames.ForwardConnection,
      patterns: new Map([
        [PatternNames.ForwardConnection, forwardConnectionPattern],
      ]),
    },
  });

  const schema = generator.generateSchemaFile();
  console.log('=== Advanced Usage (Type-Safe) ===');
  console.log(schema);
}

