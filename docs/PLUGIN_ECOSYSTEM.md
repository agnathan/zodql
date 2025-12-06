# ZodQL Plugin Ecosystem Design

## Overview

This document outlines the design for a plugin ecosystem that allows the community to extend ZodQL with custom generators. Plugins can generate code, documentation, configurations, and more from ZodQL schemas.

## Core Concepts

### 1. Plugin Interface

All plugins must implement a standard interface that provides:
- **Metadata**: Name, version, description, author
- **Input**: Access to the ZodQL schema and generator context
- **Output**: Generated artifacts (files, strings, configurations)
- **Hooks**: Lifecycle hooks for different generation phases

### 2. Plugin Types

Plugins can be categorized by what they generate:

- **Code Generators**: Generate TypeScript, JavaScript, Python, etc.
  - Example: GraphQL Operations Generator (queries, mutations, subscriptions)
  - Example: React Query hooks generator
  - Example: Apollo Client codegen
  
- **Documentation Generators**: Generate docs, API references
  - Example: OpenAPI/Swagger generator
  - Example: Markdown API documentation
  
- **Configuration Generators**: Generate config files
  - Example: AWS AppSync resolver mapping templates
  - Example: GraphQL Code Generator configs
  
- **Schema Transformers**: Transform or extend schemas
  - Example: Add federation directives
  - Example: Add custom directives

### 3. Plugin Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ZodQL Core                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Plugin Manager                            │  │
│  │  - Plugin Discovery                               │  │
│  │  - Plugin Loading                                │  │
│  │  - Plugin Execution                               │  │
│  │  - Context Provisioning                          │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │         GraphQLSchemaGenerator                     │  │
│  │  (Built-in generator, can be extended)            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Plugin Interface
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│   Plugin A   │ │   Plugin B   │ │  Plugin C  │
│ (Operations) │ │ (React Hooks)│ │ (OpenAPI)  │
└──────────────┘ └──────────────┘ └────────────┘
```

## Plugin Interface Design

### Base Plugin Interface

```typescript
interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
}

interface PluginContext {
  // Access to the generator instance
  generator: GraphQLSchemaGenerator;
  
  // The ZodQL schema configuration
  config: GeneratorConfig;
  
  // Entity name
  entityName: string;
  
  // Generated GraphQL SDL (if available)
  graphQLSchema?: string;
  
  // Registry access for type lookups
  registry: typeof Registry;
  
  // Options passed to the plugin
  options?: Record<string, any>;
}

interface PluginOutput {
  // Files to write
  files?: Array<{
    path: string;
    content: string;
  }>;
  
  // Console output/logs
  logs?: string[];
  
  // Metadata about what was generated
  metadata?: Record<string, any>;
}

interface ZodQLPlugin {
  // Plugin identification
  metadata: PluginMetadata;
  
  // Main execution method
  generate(context: PluginContext): Promise<PluginOutput> | PluginOutput;
  
  // Optional: Validate plugin can run with given context
  validate?(context: PluginContext): boolean | string;
  
  // Optional: Lifecycle hooks
  beforeGenerate?(context: PluginContext): void | Promise<void>;
  afterGenerate?(context: PluginContext, output: PluginOutput): void | Promise<void>;
}
```

## Plugin Manager

### Responsibilities

1. **Discovery**: Find plugins in node_modules, local directories, or via configuration
2. **Loading**: Load and validate plugins
3. **Execution**: Run plugins with proper context
4. **Error Handling**: Gracefully handle plugin failures
5. **Dependency Management**: Handle plugin dependencies

### Plugin Discovery

Plugins can be discovered via:

1. **Package.json convention**: `zodql-plugin-*` packages
2. **Configuration**: Explicit plugin paths in config file
3. **Local plugins**: Plugins in `./plugins` directory
4. **Programmatic**: Plugins passed directly to the manager

### Example Usage

```typescript
import { PluginManager } from 'zodql/plugins';
import { GraphQLOperationsPlugin } from 'zodql-plugin-operations';

const manager = new PluginManager({
  plugins: [
    new GraphQLOperationsPlugin({
      outputDir: './generated',
      format: 'typescript',
    }),
  ],
});

const generator = new GraphQLSchemaGenerator('User', config);
await manager.runPlugins(generator);
```

## Example: GraphQL Operations Plugin

This plugin generates TypeScript/JavaScript code for GraphQL operations (queries, mutations, subscriptions) based on the ZodQL schema.

### Features

- Generate typed query/mutation/subscription functions
- Generate operation documents (GraphQL strings)
- Generate TypeScript types for operation variables and responses
- Support for fragments
- Support for variables and arguments

### Implementation Sketch

```typescript
interface GraphQLOperationsPluginOptions {
  outputDir: string;
  format: 'typescript' | 'javascript';
  generateTypes: boolean;
  generateDocuments: boolean;
  client?: 'apollo' | 'urql' | 'react-query' | 'vanilla';
}

class GraphQLOperationsPlugin implements ZodQLPlugin {
  metadata = {
    name: 'zodql-plugin-operations',
    version: '1.0.0',
    description: 'Generates GraphQL operations from ZodQL schemas',
  };

  constructor(private options: GraphQLOperationsPluginOptions) {}

  generate(context: PluginContext): PluginOutput {
    const { generator, config } = context;
    const operations: string[] = [];

    // Generate queries
    if (config.queries) {
      for (const [name, queryFn] of Object.entries(config.queries)) {
        operations.push(this.generateQuery(name, queryFn, context));
      }
    }

    // Generate mutations
    if (config.mutations) {
      for (const [name, mutationFn] of Object.entries(config.mutations)) {
        operations.push(this.generateMutation(name, mutationFn, context));
      }
    }

    // Generate subscriptions
    if (config.subscriptions) {
      for (const [name, subFn] of Object.entries(config.subscriptions)) {
        operations.push(this.generateSubscription(name, subFn, context));
      }
    }

    return {
      files: [
        {
          path: `${this.options.outputDir}/operations.ts`,
          content: this.formatOperations(operations),
        },
      ],
    };
  }

  private generateQuery(name: string, queryFn: z.ZodFunction, context: PluginContext): string {
    // Extract arguments and return type
    // Generate GraphQL query string
    // Generate TypeScript types
    // Return formatted code
  }
}
```

## Plugin Registry & Naming Convention

### Naming Convention

- Official plugins: `@zodql/plugin-*` (scoped packages)
- Community plugins: `zodql-plugin-*` (unscoped)
- Local plugins: Any name, loaded via path

### Plugin Registry

A central registry (optional) could list available plugins:
- Plugin discovery website
- npm search integration
- Plugin marketplace

## Advanced Features

### 1. Plugin Composition

Plugins can depend on other plugins:

```typescript
interface PluginMetadata {
  // ...
  dependencies?: string[]; // Plugin names this plugin depends on
  provides?: string[]; // Capabilities this plugin provides
}
```

### 2. Plugin Hooks & Lifecycle

```typescript
interface ZodQLPlugin {
  // Called before any generation
  beforeAll?(context: PluginContext): void | Promise<void>;
  
  // Called after all plugins have run
  afterAll?(context: PluginContext, outputs: PluginOutput[]): void | Promise<void>;
  
  // Called when schema changes detected
  onSchemaChange?(oldSchema: string, newSchema: string): void;
}
```

### 3. Plugin Configuration

Plugins can expose configuration schemas:

```typescript
interface PluginConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    default?: any;
    required?: boolean;
  };
}

interface ZodQLPlugin {
  configSchema?: PluginConfigSchema;
}
```

### 4. Plugin Context Extensions

Plugins can extend the context for other plugins:

```typescript
interface PluginContext {
  // ... base context
  extensions?: Map<string, any>; // Plugin-specific data
}
```

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Define plugin interface
- [ ] Implement PluginManager
- [ ] Basic plugin discovery and loading
- [ ] Error handling

### Phase 2: First Plugin (Operations Generator)
- [ ] Implement GraphQLOperationsPlugin
- [ ] Generate queries, mutations, subscriptions
- [ ] TypeScript type generation
- [ ] Documentation

### Phase 3: Plugin Ecosystem
- [ ] Plugin registry/discovery
- [ ] Plugin composition
- [ ] Advanced hooks
- [ ] Plugin testing utilities

### Phase 4: Community Tools
- [ ] Plugin template generator (`zodql create-plugin`)
- [ ] Plugin validation tools
- [ ] Plugin documentation generator
- [ ] Examples and tutorials

## Example Plugin Ideas

1. **GraphQL Operations Generator** (queries, mutations, subscriptions)
2. **React Query Hooks Generator** (generate useQuery, useMutation hooks)
3. **Apollo Client Codegen** (generate Apollo-specific code)
4. **OpenAPI Generator** (convert ZodQL schema to OpenAPI spec)
5. **TypeScript Client Generator** (fully typed GraphQL client)
6. **Resolver Templates Generator** (AWS AppSync resolver templates)
7. **Documentation Generator** (Markdown/HTML API docs)
8. **Test Data Generator** (generate mock data from schemas)
9. **GraphQL Federation Plugin** (add federation directives)
10. **Prisma Schema Generator** (generate Prisma schema from ZodQL)

## Questions to Consider

1. **Plugin Execution Order**: Should plugins run in parallel or sequentially? How to handle dependencies?
2. **Schema Access**: Should plugins have access to the raw Zod schemas or only the generated GraphQL SDL?
3. **Incremental Generation**: Should plugins support incremental updates or always regenerate?
4. **Plugin Validation**: How strict should plugin validation be? Runtime vs compile-time?
5. **Error Handling**: Should one plugin failure stop all plugins, or continue with others?
6. **Caching**: Should plugin outputs be cached? How to invalidate?
7. **Watch Mode**: Should plugins support watch mode for development?

## Next Steps

1. Review and refine this design
2. Implement Phase 1 (core infrastructure)
3. Create example plugin (Operations Generator)
4. Gather community feedback
5. Iterate based on real-world usage
