# Relationship Patterns - Type-Safe API Guide

This guide demonstrates how to use the type-safe API for relationship patterns in ZodQL, following TypeScript best practices.

## Overview

The relationship pattern system provides two APIs:

1. **String-based API** (backward compatible) - Uses plain strings
2. **Type-safe API** (recommended) - Uses const objects, string literal types, and fluent builders

## Type-Safe Constants

### Relationship Types

Instead of using strings, use the `RelationshipTypes` constant:

```typescript
import { RelationshipTypes } from 'zodql';

// ❌ String-based (no autocomplete, prone to typos)
defineRelationship(Project, 'hasMany', Dashboard, {...});

// ✅ Type-safe (autocomplete, type-checked)
defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {...});
```

Available relationship types:
- `RelationshipTypes.HasOne`
- `RelationshipTypes.HasMany`
- `RelationshipTypes.BelongsTo`
- `RelationshipTypes.BelongsToMany`

### Pattern Names

Use the `PatternNames` constant for pattern names:

```typescript
import { PatternNames } from 'zodql/patterns';

// ❌ String-based
defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: 'forward-connection'
});

// ✅ Type-safe
defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection
});
```

Available pattern names:
- `PatternNames.ForwardConnection`
- `PatternNames.RootLevelFilter`
- `PatternNames.BackReferenceOnly`

## Fluent Builder API

For even better type safety and readability, use the fluent builder API:

### Basic Usage

```typescript
import { relationship, RelationshipTypes } from 'zodql';
import { PatternNames } from 'zodql/patterns';

// Define relationship with fluent API
relationship(Project, RelationshipTypes.HasMany, Dashboard)
  .withPattern(PatternNames.ForwardConnection)
  .withFieldName('dashboards')
  .withCount()
  .build();
```

### Available Builder Methods

- `.withPattern(pattern: PatternName)` - Set the pattern to use
- `.withFieldName(name: string)` - Set field name on source type
- `.withBackReferenceFieldName(name: string)` - Set back-reference field name
- `.withCount()` - Enable count fields
- `.withMetadata(metadata: Record<string, any>)` - Add custom metadata
- `.withPatternOptions(options: Record<string, any>)` - Set pattern-specific options
- `.build()` - Register and return the relationship

### Advanced Example

```typescript
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
```

## Type-Safe Pattern Manager

Use the builder API for creating pattern managers:

```typescript
import { createPatternManager, PatternNames } from 'zodql/patterns';

// ❌ String-based
const patternManager = new PatternManager({
  defaultPattern: 'forward-connection',
  patterns: new Map([
    ['forward-connection', forwardConnectionPattern],
  ]),
});

// ✅ Type-safe builder
const patternManager = createPatternManager()
  .withDefaultPattern(PatternNames.ForwardConnection)
  .withBuiltInPatterns()
  .withErrorHandling(true)
  .build();
```

### Pattern Manager Builder Methods

- `.withDefaultPattern(pattern: PatternName)` - Set default pattern
- `.withPattern(name: PatternName, pattern: RelationshipPattern)` - Register a pattern
- `.withBuiltInPatterns()` - Register all built-in patterns
- `.withErrorHandling(continueOnError: boolean)` - Set error handling behavior
- `.build()` - Create the PatternManager instance

## Complete Type-Safe Example

```typescript
import { z } from 'zod';
import {
  defineObject,
  Scalars,
  relationship,
  RelationshipTypes,
} from 'zodql';
import {
  GraphQLSchemaGenerator,
  GeneratorConfig,
} from 'zodql';
import {
  createPatternManager,
  PatternNames,
  forwardConnectionPattern,
} from 'zodql/patterns';

// Define types
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

// Define relationship (type-safe)
relationship(Project, RelationshipTypes.HasMany, Dashboard)
  .withPattern(PatternNames.ForwardConnection)
  .withFieldName('dashboards')
  .withCount()
  .build();

// Create pattern manager (type-safe)
const patternManager = createPatternManager()
  .withDefaultPattern(PatternNames.ForwardConnection)
  .withBuiltInPatterns()
  .build();

// Generate schema
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
```

## Benefits of Type-Safe API

1. **Autocomplete**: IDE provides suggestions for relationship types and pattern names
2. **Type Checking**: TypeScript catches typos and invalid values at compile time
3. **Refactoring**: Renaming patterns/types is safer with IDE support
4. **Documentation**: Constants serve as inline documentation
5. **Discoverability**: Easy to see available options via autocomplete

## Migration Guide

### Before (String-based)

```typescript
defineRelationship(Project, 'hasMany', Dashboard, {
  pattern: 'forward-connection',
  fieldName: 'dashboards',
});
```

### After (Type-safe)

```typescript
relationship(Project, RelationshipTypes.HasMany, Dashboard)
  .withPattern(PatternNames.ForwardConnection)
  .withFieldName('dashboards')
  .build();
```

Both APIs are supported, but the type-safe API is recommended for new code.

