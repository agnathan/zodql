# ZodQL Plugin System

This directory contains the plugin system infrastructure for ZodQL, allowing the community to extend ZodQL with custom generators.

## Overview

The plugin system enables developers to create custom generators that can:

- Generate code (TypeScript, JavaScript, Python, etc.)
- Generate documentation
- Generate configuration files
- Transform schemas
- And more!

## Quick Start

### Using a Plugin

```typescript
import { PluginManager } from "zodql/plugins";
import { GraphQLOperationsPlugin } from "zodql-plugin-operations";

const manager = new PluginManager({
  workingDir: "./generated",
});

manager.register(
  new GraphQLOperationsPlugin({
    outputDir: "./generated/operations",
    format: "typescript",
  })
);

const generator = new GraphQLSchemaGenerator("User", config);
await manager.runPlugins(generator);
```

### Creating a Plugin

1. **Implement the `ZodQLPlugin` interface:**

```typescript
import type { ZodQLPlugin, PluginContext, PluginOutput } from "zodql/plugins";

export class MyPlugin implements ZodQLPlugin {
  metadata = {
    name: "my-plugin",
    version: "1.0.0",
    description: "My awesome plugin",
  };

  generate(context: PluginContext): PluginOutput {
    // Your generation logic here
    return {
      files: [
        {
          path: "./generated/output.txt",
          content: "Generated content",
        },
      ],
      logs: ["Plugin executed successfully"],
    };
  }
}
```

2. **Access the schema information:**

```typescript
generate(context: PluginContext): PluginOutput {
  const { generator, config, entityName, graphQLSchema } = context;

  // Access queries
  if (config.queries) {
    for (const [name, queryFn] of Object.entries(config.queries)) {
      // Process query
    }
  }

  // Access mutations
  if (config.mutations) {
    // Process mutations
  }

  // Access the generated GraphQL SDL
  if (graphQLSchema) {
    // Use the schema string
  }

  return { files: [] };
}
```

3. **Validate plugin can run:**

```typescript
validate(context: PluginContext): boolean | string {
  if (!context.config.queries) {
    return 'No queries found in schema';
  }
  return true;
}
```

## Plugin Context

The `PluginContext` provides access to:

- **`generator`**: The `GraphQLSchemaGenerator` instance
- **`config`**: The `GeneratorConfig` used to create the generator
- **`entityName`**: Name of the primary entity
- **`graphQLSchema`**: Generated GraphQL SDL string (if available)
- **`registry`**: Access to the type registry
- **`options`**: Plugin-specific options
- **`workingDir`**: Working directory for file generation
- **`shared`**: Map for sharing data between plugins

## Plugin Output

Plugins return a `PluginOutput` object:

```typescript
{
  files?: Array<{
    path: string;
    content: string;
    encoding?: 'utf8' | 'binary';
  }>;
  logs?: string[];
  warnings?: string[];
  errors?: string[];
  metadata?: Record<string, any>;
  shared?: Record<string, any>;
}
```

## Examples

See `examples/GraphQLOperationsPlugin.ts` for a complete example plugin that generates GraphQL operations.

## Plugin Discovery

Plugins can be discovered via:

1. **NPM packages**: `zodql-plugin-*` or `@zodql/plugin-*`
2. **Local files**: Import and register directly
3. **Configuration**: Specify plugin paths in config

## Best Practices

1. **Validate early**: Use the `validate()` method to check prerequisites
2. **Provide helpful errors**: Return descriptive error messages
3. **Use lifecycle hooks**: Leverage `beforeGenerate()` and `afterGenerate()` for setup/cleanup
4. **Document options**: Use `configSchema` to document plugin options
5. **Handle errors gracefully**: Don't throw unless absolutely necessary
6. **Share data**: Use `shared` context to pass data to other plugins

## Plugin Dependencies

Plugins can declare dependencies:

```typescript
metadata = {
  name: "my-plugin",
  version: "1.0.0",
  dependencies: ["other-plugin"], // Runs after other-plugin
};
```

## Publishing a Plugin

1. Name your package: `zodql-plugin-<name>` or `@zodql/plugin-<name>`
2. Add `zodql` as a peer dependency
3. Export your plugin class
4. Add keywords: `['zodql', 'zodql-plugin']`
5. Publish to npm

## Questions?

See `docs/PLUGIN_ECOSYSTEM.md` for the full design document.
