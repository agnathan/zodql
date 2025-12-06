import { z } from 'zod';
import type { GeneratorConfig } from '../generators/GraphQLSchemaGenerator.js';
import type { Registry } from '../zodql/registry.js';

/**
 * =================================================================================
 * Schema Extension Types
 * =================================================================================
 *
 * Defines the interface for extensions that hook into the GraphQL schema
 * generation lifecycle. Extensions can transform the configuration, add types,
 * modify schemas, and inject custom SDL.
 *
 * This is separate from ZodQLPlugin (which runs after generation) - these
 * extensions run during schema generation to modify the output.
 */

/**
 * Context provided to extensions during schema generation
 */
export interface ExtensionContext {
  /** The generator configuration (can be modified) */
  config: GeneratorConfig;
  
  /** The entity name being generated */
  entityName: string;
  
  /** Registry for type lookups and registration */
  registry: typeof Registry;
  
  /** Shared data between extensions */
  shared: Map<string, any>;
  
  /** Current phase of generation */
  phase: GenerationPhase;
}

/**
 * Phases of schema generation lifecycle
 */
export enum GenerationPhase {
  /** Before any processing - initial setup */
  INITIALIZATION = 'initialization',
  
  /** Before dependency discovery - prepare relationships, etc. */
  BEFORE_DISCOVERY = 'before_discovery',
  
  /** After dependency discovery - transform discovered types */
  AFTER_DISCOVERY = 'after_discovery',
  
  /** Before type generation - final transformations */
  BEFORE_GENERATION = 'before_generation',
  
  /** After type generation - add custom SDL */
  AFTER_GENERATION = 'after_generation',
}

/**
 * Result of an extension transformation
 */
export interface ExtensionTransformResult {
  /** Modified configuration */
  config?: Partial<GeneratorConfig>;
  
  /** Additional types to register */
  additionalTypes?: Array<{
    name: string;
    schema: z.ZodTypeAny;
  }>;
  
  /** Custom SDL to prepend to schema */
  preamble?: string;
  
  /** Custom SDL to append to schema */
  postamble?: string;
  
  /** Metadata about transformations */
  metadata?: Record<string, any>;
}

/**
 * Schema extension interface
 * 
 * Extensions hook into the schema generation lifecycle to transform
 * configurations, modify types, and inject custom SDL.
 */
export interface SchemaExtension {
  /** Unique name for this extension */
  name: string;
  
  /** Human-readable description */
  description?: string;
  
  /** Dependencies on other extensions (by name) */
  dependencies?: string[];
  
  /**
   * Hook called during initialization phase
   * Use this to set up extension state, validate config, etc.
   */
  onInitialization?(context: ExtensionContext): void | Promise<void>;
  
  /**
   * Hook called before dependency discovery
   * Use this to prepare relationships, register types, etc.
   */
  beforeDiscovery?(context: ExtensionContext): ExtensionTransformResult | Promise<ExtensionTransformResult> | void | Promise<void>;
  
  /**
   * Hook called after dependency discovery
   * Use this to transform discovered types, modify config based on discovered types
   */
  afterDiscovery?(context: ExtensionContext): ExtensionTransformResult | Promise<ExtensionTransformResult> | void | Promise<void>;
  
  /**
   * Hook called before schema generation
   * Use this for final transformations before SDL is generated
   */
  beforeGeneration?(context: ExtensionContext): ExtensionTransformResult | Promise<ExtensionTransformResult> | void | Promise<void>;
  
  /**
   * Hook called after schema generation
   * Use this to add custom SDL, validate output, etc.
   */
  afterGeneration?(context: ExtensionContext, schemaSDL: string): string | Promise<string> | void | Promise<void>;
  
  /**
   * Optional: Validate that extension can run with given context
   */
  validate?(context: ExtensionContext): boolean | string;
}

/**
 * Options for ExtensionManager
 */
export interface ExtensionManagerOptions {
  /** Extensions to register */
  extensions?: SchemaExtension[];
  
  /** Whether to continue on extension errors */
  continueOnError?: boolean;
  
  /** Custom execution order (overrides dependency resolution) */
  executionOrder?: string[];
}

