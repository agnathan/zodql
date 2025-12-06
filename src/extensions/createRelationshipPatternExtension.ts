import { RelationshipPatternExtension, RelationshipPatternExtensionOptions } from './RelationshipPatternExtension.js';
import { PatternNames } from '../patterns/constants.js';
import { forwardConnectionPattern } from '../patterns/forward-connection.js';
import { rootLevelFilterPattern } from '../patterns/root-level-filter.js';
import { backReferenceOnlyPattern } from '../patterns/back-reference-only.js';
import type { RelationshipPattern } from '../patterns/types.js';

/**
 * =================================================================================
 * Create Relationship Pattern Extension Helper
 * =================================================================================
 *
 * Convenience function to create a RelationshipPatternExtension with default
 * patterns pre-registered. This improves developer experience by providing
 * sensible defaults.
 */

/**
 * Options for creating a relationship pattern extension
 */
export interface CreateRelationshipPatternExtensionOptions {
  /** Default pattern to use when relationship doesn't specify one */
  defaultPattern?: typeof PatternNames[keyof typeof PatternNames] | string;
  
  /** Additional patterns to register */
  patterns?: Map<string, RelationshipPattern>;
  
  /** Whether to continue on errors */
  continueOnError?: boolean;
}

/**
 * Creates a RelationshipPatternExtension with default patterns registered.
 * 
 * This is the recommended way to create the extension as it includes
 * all built-in patterns (forward-connection, root-level-filter, back-reference-only).
 * 
 * @example
 * ```typescript
 * import { createRelationshipPatternExtension } from 'zodql/extensions';
 * 
 * const extension = createRelationshipPatternExtension({
 *   defaultPattern: PatternNames.BackReferenceOnly,
 * });
 * 
 * const generator = new GraphQLSchemaGenerator('Project', config, {
 *   extensions: [extension]
 * });
 * ```
 */
export function createRelationshipPatternExtension(
  options: CreateRelationshipPatternExtensionOptions = {}
): RelationshipPatternExtension {
  const patterns = new Map<string, RelationshipPattern>();
  
  // Register default patterns
  patterns.set(PatternNames.ForwardConnection, forwardConnectionPattern);
  patterns.set(PatternNames.RootLevelFilter, rootLevelFilterPattern);
  patterns.set(PatternNames.BackReferenceOnly, backReferenceOnlyPattern);
  
  // Register additional patterns if provided
  if (options.patterns) {
    for (const [name, pattern] of options.patterns) {
      patterns.set(name, pattern);
    }
  }
  
  const extensionOptions: RelationshipPatternExtensionOptions = {
    defaultPattern: options.defaultPattern || PatternNames.BackReferenceOnly,
    patterns,
    continueOnError: options.continueOnError ?? true,
  };
  
  return new RelationshipPatternExtension(extensionOptions);
}

