/**
 * =================================================================================
 * Pattern Constants
 * =================================================================================
 *
 * Type-safe constants for pattern names and pattern registry.
 */

/**
 * Built-in pattern names as const for type safety
 */
export const PatternNames = {
  ForwardConnection: 'forward-connection',
  RootLevelFilter: 'root-level-filter',
  BackReferenceOnly: 'back-reference-only',
} as const;

/**
 * Type for pattern names
 */
export type PatternName = typeof PatternNames[keyof typeof PatternNames];

/**
 * Pattern registry mapping pattern names to pattern instances
 */
export interface PatternRegistry {
  [PatternNames.ForwardConnection]: typeof import('./forward-connection.js').forwardConnectionPattern;
  [PatternNames.RootLevelFilter]: typeof import('./root-level-filter.js').rootLevelFilterPattern;
  [PatternNames.BackReferenceOnly]: typeof import('./back-reference-only.js').backReferenceOnlyPattern;
}

/**
 * Helper type to extract pattern instance type from pattern name
 */
export type PatternInstance<T extends PatternName> = PatternRegistry[T];

