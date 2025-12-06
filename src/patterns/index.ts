/**
 * =================================================================================
 * Relationship Patterns
 * =================================================================================
 *
 * Exports for relationship patterns and pattern management.
 */

export * from './types.js';
export * from './PatternManager.js';
export * from './forward-connection.js';
export * from './root-level-filter.js';
export * from './back-reference-only.js';
export * from './constants.js';
export * from './cardinality.js';

// Re-export default instances for convenience
export { forwardConnectionPattern } from './forward-connection.js';
export { rootLevelFilterPattern } from './root-level-filter.js';
export { backReferenceOnlyPattern } from './back-reference-only.js';

// Re-export pattern names constant
export { PatternNames } from './constants.js';

