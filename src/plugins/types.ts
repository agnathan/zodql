/**
 * =================================================================================
 * Plugin Types & Interfaces
 * =================================================================================
 *
 * Core type definitions for the ZodQL plugin ecosystem.
 * All plugins must implement the ZodQLPlugin interface.
 */

import { z } from 'zod';
import { GraphQLSchemaGenerator, GeneratorConfig } from '../generators/GraphQLSchemaGenerator.js';
import { Registry } from '../zodql/registry.js';

/**
 * Metadata about a plugin for identification and discovery.
 */
export interface PluginMetadata {
  /** Unique plugin name (e.g., 'zodql-plugin-operations') */
  name: string;
  
  /** Plugin version (semver) */
  version: string;
  
  /** Human-readable description */
  description: string;
  
  /** Plugin author name */
  author?: string;
  
  /** Plugin homepage URL */
  homepage?: string;
  
  /** Repository URL */
  repository?: string;
  
  /** Keywords for discovery */
  keywords?: string[];
  
  /** Other plugins this plugin depends on */
  dependencies?: string[];
  
  /** Capabilities this plugin provides */
  provides?: string[];
}

/**
 * Context provided to plugins during execution.
 * Contains all information a plugin needs to generate artifacts.
 */
export interface PluginContext {
  /** The GraphQL schema generator instance */
  generator: GraphQLSchemaGenerator;
  
  /** The ZodQL configuration used to create the generator */
  config: GeneratorConfig;
  
  /** Name of the primary entity */
  entityName: string;
  
  /** Generated GraphQL SDL (if available) */
  graphQLSchema?: string;
  
  /** Access to the type registry */
  registry: typeof Registry;
  
  /** Plugin-specific options */
  options?: Record<string, any>;
  
  /** Working directory for file generation */
  workingDir?: string;
  
  /** Shared data between plugins */
  shared?: Map<string, any>;
}

/**
 * Output produced by a plugin.
 */
export interface PluginOutput {
  /** Files to write (path relative to workingDir or absolute) */
  files?: Array<{
    path: string;
    content: string;
    encoding?: 'utf8' | 'binary';
  }>;
  
  /** Console output/logs */
  logs?: string[];
  
  /** Warnings */
  warnings?: string[];
  
  /** Errors (non-fatal) */
  errors?: string[];
  
  /** Metadata about what was generated */
  metadata?: Record<string, any>;
  
  /** Data to share with other plugins */
  shared?: Record<string, any>;
}

/**
 * Configuration schema for a plugin.
 * Used for validation and documentation.
 */
export interface PluginConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    default?: any;
    required?: boolean;
    enum?: any[];
  };
}

/**
 * Main plugin interface that all plugins must implement.
 */
export interface ZodQLPlugin {
  /** Plugin identification metadata */
  metadata: PluginMetadata;
  
  /** Configuration schema (optional) */
  configSchema?: PluginConfigSchema;
  
  /**
   * Main execution method.
   * Called to generate artifacts from the ZodQL schema.
   * 
   * @param context Plugin execution context
   * @returns Generated output (can be async)
   */
  generate(context: PluginContext): Promise<PluginOutput> | PluginOutput;
  
  /**
   * Optional validation method.
   * Called before generate() to check if plugin can run.
   * 
   * @param context Plugin execution context
   * @returns true if valid, or error message string if invalid
   */
  validate?(context: PluginContext): boolean | string;
  
  /**
   * Optional lifecycle hook called before generation.
   */
  beforeGenerate?(context: PluginContext): void | Promise<void>;
  
  /**
   * Optional lifecycle hook called after generation.
   */
  afterGenerate?(context: PluginContext, output: PluginOutput): void | Promise<void>;
}

/**
 * Plugin execution result.
 */
export interface PluginExecutionResult {
  /** Plugin metadata */
  plugin: PluginMetadata;
  
  /** Generated output */
  output: PluginOutput;
  
  /** Execution time in milliseconds */
  duration: number;
  
  /** Whether execution succeeded */
  success: boolean;
  
  /** Error if execution failed */
  error?: Error;
}

/**
 * Options for the PluginManager.
 */
export interface PluginManagerOptions {
  /** Working directory for file generation */
  workingDir?: string;
  
  /** Whether to continue on plugin errors */
  continueOnError?: boolean;
  
  /** Whether to run plugins in parallel */
  parallel?: boolean;
  
  /** Custom context extensions */
  contextExtensions?: Record<string, any>;
}
