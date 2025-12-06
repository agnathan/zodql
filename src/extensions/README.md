# Schema Extensions

Schema extensions allow you to hook into the GraphQL schema generation lifecycle to transform configurations, modify types, and inject custom SDL.

## Overview

Extensions provide a clean, composable way to extend ZodQL's schema generation capabilities. They follow the **Extension Registry Pattern** and integrate seamlessly with the generator lifecycle.

## Quick Start

### Using Relationship Patterns Extension

The most common use case is applying relationship patterns:

```typescript
import { 
  defineObject, 
  relationship, 
  RelationshipTypes,
  GraphQLSchemaGenerator 
} from 'zodql';
import { 
  createRelationshipPatternExtension,
  PatternNames 
} from 'zodql/extensions';

// Define your types
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID, title: Scalars.String }
});

// Define relationship
relationship(Project, RelationshipTypes.HasMany, Dashboard)
  .withPattern(PatternNames.ForwardConnection)
  .withCount()
  .register();

// Create extension with default patterns
const patternExtension = createRelationshipPatternExtension({
  defaultPattern: PatternNames.BackReferenceOnly,
});

// Generate schema with extension
const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project,
}, {
  extensions: [patternExtension]
});

const schema = await generator.generateSchemaFile();
```

## Extension Lifecycle

Extensions can hook into five phases:

1. **Initialization** - Set up extension state, validate config
2. **Before Discovery** - Prepare relationships, register types
3. **After Discovery** - Transform discovered types
4. **Before Generation** - Final transformations before SDL generation
5. **After Generation** - Modify final SDL, add custom definitions

## Creating Custom Extensions

```typescript
import { SchemaExtension, ExtensionContext, ExtensionTransformResult } from 'zodql/extensions';
import { GenerationPhase } from 'zodql/extensions';

class MyCustomExtension implements SchemaExtension {
  name = 'my-custom-extension';
  description = 'Adds custom functionality';
  
  dependencies = []; // Optional: other extensions this depends on
  
  async beforeDiscovery(context: ExtensionContext): Promise<ExtensionTransformResult> {
    // Modify config before dependency discovery
    return {
      config: {
        ...context.config,
        // Add custom modifications
      },
    };
  }
  
  async afterGeneration(context: ExtensionContext, schemaSDL: string): Promise<string> {
    // Modify final SDL
    return schemaSDL + '\n\n# Custom additions';
  }
}
```

## Extension Manager

The `ExtensionManager` coordinates extension execution:

- **Dependency Resolution**: Automatically resolves extension dependencies using topological sorting
- **Error Handling**: Configurable `continueOnError` behavior
- **Execution Order**: Ensures extensions run in the correct order

## Best Practices

1. **Use `createRelationshipPatternExtension`** for relationship patterns - it includes all built-in patterns
2. **Declare dependencies** if your extension depends on others
3. **Return immutable transformations** - don't mutate the context directly
4. **Validate early** - use the `validate` method to fail fast
5. **Use shared context** - store data in `context.shared` for communication between extensions

## API Reference

See the TypeScript definitions in `src/extensions/types.ts` for complete API documentation.

