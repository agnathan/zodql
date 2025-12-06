import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { z } from "zod";
import { GraphQLSchemaGenerator } from "../src/generators/GraphQLSchemaGenerator.js";
import {
  Scalars,
  defineObject,
  field,
  Registry,
  RelationshipTypes,
  defineRelationship,
  relationship,
  RelationshipRegistry,
} from "../src/zodql/index.js";
import {
  PatternManager,
  createPatternManager,
  PatternNames,
  forwardConnectionPattern,
  rootLevelFilterPattern,
  backReferenceOnlyPattern,
} from "../src/patterns/index.js";
import {
  createRelationshipPatternExtension,
} from "../src/extensions/index.js";
import {
  captureTestInput,
  captureTestOutput,
  captureTestError,
  finalizeTest,
  writeTestSummaries,
  setDescribeBlock,
  setTestFileName,
} from "../src/test-reporter.js";
import { validateGraphQLSchema } from "../src/validation/schema-validator.js";
import { lintGraphQLSchema } from "../src/validation/schema-linter.js";

// Store current test context
let currentTestName: string | undefined;

// Helper to capture schema output
function captureSchema(schema: string) {
  if (currentTestName) {
    captureTestOutput(schema);
  }
  return schema;
}

// Helper to validate and lint a schema
function validateAndLintSchema(schema: string, testName?: string): {
  valid: boolean;
  lintValid: boolean;
  validationErrors: string[];
  lintErrors: Array<{ rule: string; message: string }>;
  lintWarnings: Array<{ rule: string; message: string }>;
} {
  const validation = validateGraphQLSchema(schema);
  const linting = lintGraphQLSchema(schema);

  const validationErrors = validation.errors;
  const lintErrors = linting.issues.filter(i => i.severity === 'error').map(i => ({
    rule: i.rule,
    message: i.message,
  }));
  const lintWarnings = linting.issues.filter(i => i.severity === 'warning').map(i => ({
    rule: i.rule,
    message: i.message,
  }));

  if (testName && (!validation.valid || linting.errorCount > 0)) {
    console.error(`\n[${testName}] Validation/Linting Issues:`);
    if (!validation.valid) {
      console.error('Validation Errors:', validationErrors);
    }
    if (linting.errorCount > 0) {
      console.error('Linting Errors:', lintErrors);
    }
    if (linting.warningCount > 0) {
      console.warn('Linting Warnings:', lintWarnings);
    }
  }

  return {
    valid: validation.valid,
    lintValid: linting.errorCount === 0,
    validationErrors,
    lintErrors,
    lintWarnings,
  };
}

// Helper to wrap tests with automatic input/output capture
// Supports both sync and async test functions
async function withTestCapture(zodqlCode: string, testFn: () => void | Promise<void>) {
  if (!currentTestName) {
    throw new Error("Test name not set. Make sure beforeEach is running.");
  }

  captureTestInput(currentTestName, zodqlCode);
  let passed = false;

  try {
    const result = testFn();
    // Handle async test functions
    if (result instanceof Promise) {
      await result;
    }
    passed = true;
  } catch (error: any) {
    captureTestError(error.message || String(error));
    throw error;
  } finally {
    finalizeTest(passed);
  }
}

// Helper to validate and lint a schema (used in tests)
function assertValidAndLinted(schema: string, testName: string) {
  const { valid, lintValid, validationErrors, lintErrors, lintWarnings } = validateAndLintSchema(schema, testName);
  
  if (!valid || !lintValid) {
    const errors: string[] = [];
    if (!valid) {
      errors.push(`Validation errors: ${validationErrors.join('; ')}`);
    }
    if (!lintValid) {
      errors.push(`Linting errors: ${lintErrors.map(e => `${e.rule}: ${e.message}`).join('; ')}`);
    }
    if (lintWarnings.length > 0) {
      errors.push(`Linting warnings: ${lintWarnings.map(w => `${w.rule}: ${w.message}`).join('; ')}`);
    }
    throw new Error(`Schema validation/linting failed for "${testName}": ${errors.join(' | ')}`);
  }
  
  // Return warnings for potential separate test creation
  return { lintWarnings };
}

describe("Relationship Patterns", () => {
  beforeEach((ctx) => {
    // Clear registries before each test
    Registry.clear();
    RelationshipRegistry.clear();
    
    // Capture test file name from context
    const filePath = ctx.task?.file?.name || 'relationship-patterns.test.ts';
    const fileName = filePath.split(/[/\\]/).pop() || 'relationship-patterns.test.ts';
    setTestFileName(fileName);
    
    // Capture test name from context
    currentTestName = ctx.task?.name;
    
    // Capture describe block name from suite hierarchy
    let suite = ctx.task?.suite;
    while (suite) {
      if (suite.name && suite.name !== '') {
        setDescribeBlock(suite.name);
        break;
      }
      suite = (suite as any).parent;
    }
    if (!suite) {
      setDescribeBlock('Uncategorized');
    }
  });

  afterEach(() => {
    // Clean up test context
    currentTestName = undefined;
  });

  afterAll(() => {
    // Write all test summaries to files
    writeTestSummaries();
  });

  // ============================================================================
  // Relationship Registry Tests
  // ============================================================================

  describe("Relationship Registry", () => {
    it("should register a relationship using defineRelationship", () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID, title: Scalars.String }
});

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection,
  fieldName: 'dashboards'
});
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID, name: Scalars.String }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: { id: Scalars.ID, title: Scalars.String }
        });

        const rel = defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection,
          fieldName: 'dashboards'
        });

        expect(rel).toBeDefined();
        expect(rel.sourceTypeName).toBe('Project');
        expect(rel.targetTypeName).toBe('Dashboard');
        expect(rel.relationshipType).toBe(RelationshipTypes.HasMany);
        expect(rel.options.fieldName).toBe('dashboards');
        expect(rel.options.pattern).toBe(PatternNames.ForwardConnection);
      });
    });

    it("should register a relationship using fluent builder API", () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID, title: Scalars.String }
});

relationship(Project, RelationshipTypes.HasMany, Dashboard)
  .withPattern(PatternNames.ForwardConnection)
  .withFieldName('dashboards')
  .withCount()
  .build();
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID, name: Scalars.String }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: { id: Scalars.ID, title: Scalars.String }
        });

        const rel = relationship(Project, RelationshipTypes.HasMany, Dashboard)
          .withPattern(PatternNames.ForwardConnection)
          .withFieldName('dashboards')
          .withCount()
          .build();

        expect(rel).toBeDefined();
        expect(rel.options.fieldName).toBe('dashboards');
        expect(rel.options.includeCount).toBe(true);
        expect(rel.options.pattern).toBe(PatternNames.ForwardConnection);
      });
    });

    it("should generate default field names based on relationship type", () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID }
});

// hasMany should pluralize
const rel1 = defineRelationship(Project, RelationshipTypes.HasMany, Dashboard);

// belongsTo should be singular
const rel2 = defineRelationship(Dashboard, RelationshipTypes.BelongsTo, Project);
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: { id: Scalars.ID }
        });

        const rel1 = defineRelationship(Project, RelationshipTypes.HasMany, Dashboard);
        expect(rel1.options.fieldName).toBe('dashboards'); // pluralized

        const rel2 = defineRelationship(Dashboard, RelationshipTypes.BelongsTo, Project);
        expect(rel2.options.fieldName).toBe('project'); // singular
      });
    });

    it("should retrieve relationships by source type", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });
const User = defineObject('User', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard);
defineRelationship(Project, RelationshipTypes.BelongsTo, User);

const relationships = RelationshipRegistry.getBySource('Project');
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });
        const User = defineObject('User', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard);
        defineRelationship(Project, RelationshipTypes.BelongsTo, User);

        const relationships = RelationshipRegistry.getBySource('Project');
        expect(relationships).toHaveLength(2);
        expect(relationships[0].targetTypeName).toBe('Dashboard');
        expect(relationships[1].targetTypeName).toBe('User');
      });
    });

    it("should retrieve relationships by target type", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard);

const relationships = RelationshipRegistry.getByTarget('Dashboard');
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard);

        const relationships = RelationshipRegistry.getByTarget('Dashboard');
        expect(relationships).toHaveLength(1);
        expect(relationships[0].sourceTypeName).toBe('Project');
      });
    });

    it("should throw error when registering relationship with unregistered types", () => {
      const zodqlCode = `
const Project = z.object({ id: Scalars.ID });
const Dashboard = z.object({ id: Scalars.ID });

// This should throw because types aren't registered
defineRelationship(Project, RelationshipTypes.HasMany, Dashboard);
`;

      withTestCapture(zodqlCode, () => {
        const Project = z.object({ id: Scalars.ID });
        const Dashboard = z.object({ id: Scalars.ID });

        expect(() => {
          defineRelationship(Project as any, RelationshipTypes.HasMany, Dashboard as any);
        }).toThrow('Both source and target types must be registered');
      });
    });
  });

  // ============================================================================
  // Forward Connection Pattern Tests
  // ============================================================================

  describe("Forward Connection Pattern", () => {
    it("should generate forward connection pattern with pagination", async () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID, title: Scalars.String }
});

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection,
  fieldName: 'dashboards'
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project,
  queries: {
    project: field({ id: Scalars.ID }, Project)
  }
}, {
  applyPatterns: true,
  patternManager: {
    defaultPattern: PatternNames.ForwardConnection,
    patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID, name: Scalars.String }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: { id: Scalars.ID, title: Scalars.String }
        });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection,
          fieldName: 'dashboards'
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.ForwardConnection,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project,
          queries: {
            project: field({ id: Scalars.ID }, Project)
          }
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('type Project {');
        expect(schema).toContain('dashboards(first: Int, after: String): DashboardConnection!');
        expect(schema).toContain('type DashboardConnection {');
        expect(schema).toContain('type DashboardEdge {');
        expect(schema).toContain('type PageInfo {');
        expect(schema).toContain('project: Project!');

        // Validate and lint the generated schema
        const { valid, lintValid, validationErrors, lintErrors } = validateAndLintSchema(schema, 'should generate forward connection pattern with pagination');
        expect(valid).toBe(true);
        expect(validationErrors).toHaveLength(0);
        expect(lintValid).toBe(true);
        expect(lintErrors).toHaveLength(0);
      });
    });

    it("should include count field when includeCount is true", async () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID, title: Scalars.String }
});

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection,
  fieldName: 'dashboards',
  includeCount: true
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID, name: Scalars.String }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: { id: Scalars.ID, title: Scalars.String }
        });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection,
          fieldName: 'dashboards',
          includeCount: true
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.ForwardConnection,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('dashboardsCount: Int!');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should include count field when includeCount is true');
      });
    });

    it("should create Connection type with totalCount when includeCount is true", async () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection,
  includeCount: true
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection,
          includeCount: true
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.ForwardConnection,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('totalCount: Int');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should create Connection type with totalCount when includeCount is true');
      });
    });

    it("should add back-reference field to target type", async () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection,
  backReferenceFieldName: 'project'
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection,
          backReferenceFieldName: 'project'
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.ForwardConnection,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('type Dashboard {');
        expect(schema).toContain('project: Project!');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should add back-reference field to target type');
      });
    });

    it("should support all relationship types (pattern is relationship-type agnostic)", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

// Forward connection should support all relationship types
const rel1 = defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection
});

const rel2 = defineRelationship(Project, RelationshipTypes.HasOne, Dashboard, {
  pattern: PatternNames.ForwardConnection
});

const rel3 = defineRelationship(Project, RelationshipTypes.BelongsTo, Dashboard, {
  pattern: PatternNames.ForwardConnection
});
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        const rel1 = defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection
        });

        expect(forwardConnectionPattern.supports(rel1.relationshipType)).toBe(true);

        const rel2 = defineRelationship(Project, RelationshipTypes.HasOne, Dashboard, {
          pattern: PatternNames.ForwardConnection
        });

        expect(forwardConnectionPattern.supports(rel2.relationshipType)).toBe(true);

        const rel3 = defineRelationship(Project, RelationshipTypes.BelongsTo, Dashboard, {
          pattern: PatternNames.ForwardConnection
        });

        expect(forwardConnectionPattern.supports(rel3.relationshipType)).toBe(true);
      });
    });
  });

  // ============================================================================
  // Root-Level Filter Pattern Tests
  // ============================================================================

  describe("Root-Level Filter Pattern", () => {
    it("should generate root-level filter pattern with query operation", async () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID, title: Scalars.String }
});

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.RootLevelFilter,
  fieldName: 'dashboards'
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project,
  queries: {
    project: field({ id: Scalars.ID }, Project)
  }
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.RootLevelFilter, rootLevelFilterPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID, name: Scalars.String }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: { id: Scalars.ID, title: Scalars.String }
        });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.RootLevelFilter,
          fieldName: 'dashboards'
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.RootLevelFilter,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project,
          queries: {
            project: field({ id: Scalars.ID }, Project)
          }
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('type Query {');
        expect(schema).toContain('dashboards(projectId: ID!, first: Int, after: String): DashboardConnection!');
        expect(schema).toContain('type DashboardConnection {');
        expect(schema).toContain('projectId: ID!');
        expect(schema).toContain('project: Project!');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should generate root-level filter pattern with query operation');
      });
    });

    it("should not add connection field to source type", async () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID, title: Scalars.String }
});

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.RootLevelFilter,
  fieldName: 'dashboards'
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.RootLevelFilter, rootLevelFilterPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID, name: Scalars.String }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: { id: Scalars.ID, title: Scalars.String }
        });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.RootLevelFilter,
          fieldName: 'dashboards'
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.RootLevelFilter,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('type Project {');
        // Check that Project type doesn't have dashboards field
        const projectTypeMatch = schema.match(/type Project \{([\s\S]*?)\n\}/);
        expect(projectTypeMatch).toBeTruthy();
        expect(projectTypeMatch![1]).not.toContain('dashboards(');
        // But dashboards should be in Query type (root-level filter pattern)
        expect(schema).toContain('dashboards(projectId: ID!'); // Should be in Query

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should not add connection field to source type');
      });
    });

    it("should add source ID field to target type for caching", async () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.RootLevelFilter,
  backReferenceFieldName: 'project'
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.RootLevelFilter, rootLevelFilterPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.RootLevelFilter,
          backReferenceFieldName: 'project'
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.RootLevelFilter,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('projectId: ID!');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should add source ID field to target type for caching');
      });
    });

    it("should include optional count field on source type when includeCount is true", async () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.RootLevelFilter,
  includeCount: true
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.RootLevelFilter, rootLevelFilterPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.RootLevelFilter,
          includeCount: true
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.RootLevelFilter,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        // Should have optional count field
        expect(schema).toContain('dashboardsCount');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should include optional count field on source type when includeCount is true');
      });
    });
  });

  // ============================================================================
  // Back-Reference Only Pattern Tests
  // ============================================================================

  describe("Back-Reference Only Pattern", () => {
    it("should only add back-reference field without connection", async () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID, title: Scalars.String }
});

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.BackReferenceOnly,
  backReferenceFieldName: 'project'
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.BackReferenceOnly, backReferenceOnlyPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID, name: Scalars.String }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: { id: Scalars.ID, title: Scalars.String }
        });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.BackReferenceOnly,
          backReferenceFieldName: 'project'
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.BackReferenceOnly,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('type Dashboard {');
        expect(schema).toContain('project: Project!');
        expect(schema).not.toContain('DashboardConnection');
        expect(schema).not.toContain('dashboards(');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should only add back-reference field without connection');
      });
    });

    it("should support all relationship types", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

const rel1 = defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.BackReferenceOnly
});

const rel2 = defineRelationship(Project, RelationshipTypes.HasOne, Dashboard, {
  pattern: PatternNames.BackReferenceOnly
});

const rel3 = defineRelationship(Dashboard, RelationshipTypes.BelongsTo, Project, {
  pattern: PatternNames.BackReferenceOnly
});
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        const rel1 = defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.BackReferenceOnly
        });
        expect(backReferenceOnlyPattern.supports(rel1.relationshipType)).toBe(true);

        const rel2 = defineRelationship(Project, RelationshipTypes.HasOne, Dashboard, {
          pattern: PatternNames.BackReferenceOnly
        });
        expect(backReferenceOnlyPattern.supports(rel2.relationshipType)).toBe(true);

        const rel3 = defineRelationship(Dashboard, RelationshipTypes.BelongsTo, Project, {
          pattern: PatternNames.BackReferenceOnly
        });
        expect(backReferenceOnlyPattern.supports(rel3.relationshipType)).toBe(true);
      });
    });
  });

  // ============================================================================
  // Pattern Manager Tests
  // ============================================================================

  describe("Pattern Manager", () => {
    it("should apply patterns using PatternManager", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection
});

const patternManager = new PatternManager({
  defaultPattern: PatternNames.ForwardConnection,
  patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
});

const { modifiedConfig } = patternManager.applyPatterns({
  schema: Project
}, 'Project');
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection
        });

        const patternManager = new PatternManager({
          defaultPattern: PatternNames.ForwardConnection,
          patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
        });

        const { modifiedConfig } = patternManager.applyPatterns({
          schema: Project
        }, 'Project');

        expect(modifiedConfig.schema).toBeDefined();
        const schemaShape = (modifiedConfig.schema as z.ZodObject<any>).shape;
        expect(schemaShape).toHaveProperty('dashboards');
      });
    });

    it("should use default pattern when relationship doesn't specify one", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard);

const patternManager = new PatternManager({
  defaultPattern: PatternNames.BackReferenceOnly,
  patterns: new Map([[PatternNames.BackReferenceOnly, backReferenceOnlyPattern]])
});

const { modifiedConfig } = patternManager.applyPatterns({
  schema: Project
}, 'Project');
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard);

        const patternManager = new PatternManager({
          defaultPattern: PatternNames.BackReferenceOnly,
          patterns: new Map([[PatternNames.BackReferenceOnly, backReferenceOnlyPattern]])
        });

        const { modifiedConfig } = patternManager.applyPatterns({
          schema: Project
        }, 'Project');

        expect(modifiedConfig.schema).toBeDefined();
      });
    });

    it("should use createPatternManager builder API", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection
});

const patternManager = createPatternManager()
  .withDefaultPattern(PatternNames.ForwardConnection)
  .withBuiltInPatterns()
  .build();

const { modifiedConfig } = patternManager.applyPatterns({
  schema: Project
}, 'Project');
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection
        });

        const patternManager = createPatternManager()
          .withDefaultPattern(PatternNames.ForwardConnection)
          .withBuiltInPatterns()
          .build();

        const { modifiedConfig } = patternManager.applyPatterns({
          schema: Project
        }, 'Project');

        expect(modifiedConfig.schema).toBeDefined();
      });
    });

    it("should handle multiple relationships with different patterns", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });
const User = defineObject('User', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection
});

defineRelationship(Project, RelationshipTypes.BelongsTo, User, {
  pattern: PatternNames.BackReferenceOnly
});

const patternManager = createPatternManager()
  .withBuiltInPatterns()
  .build();

const { modifiedConfig } = patternManager.applyPatterns({
  schema: Project
}, 'Project');
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });
        const User = defineObject('User', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection
        });

        defineRelationship(Project, RelationshipTypes.BelongsTo, User, {
          pattern: PatternNames.BackReferenceOnly
        });

        const patternManager = createPatternManager()
          .withBuiltInPatterns()
          .build();

        const { modifiedConfig } = patternManager.applyPatterns({
          schema: Project
        }, 'Project');

        expect(modifiedConfig.schema).toBeDefined();
      });
    });

    it("should continue on error when continueOnError is true", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: 'non-existent-pattern'
});

const patternManager = new PatternManager({
  defaultPattern: PatternNames.ForwardConnection,
  patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]]),
  continueOnError: true
});

const { modifiedConfig } = patternManager.applyPatterns({
  schema: Project
}, 'Project');
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: 'non-existent-pattern'
        });

        const patternManager = new PatternManager({
          defaultPattern: PatternNames.ForwardConnection,
          patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]]),
          continueOnError: true
        });

        // Should not throw, but log warning
        const { modifiedConfig } = patternManager.applyPatterns({
          schema: Project
        }, 'Project');

        expect(modifiedConfig).toBeDefined();
      });
    });

    it("should throw error when continueOnError is false and pattern not found", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: 'non-existent-pattern'
});

const patternManager = new PatternManager({
  defaultPattern: PatternNames.ForwardConnection,
  patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]]),
  continueOnError: false
});

patternManager.applyPatterns({ schema: Project }, 'Project');
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: 'non-existent-pattern'
        });

        const patternManager = new PatternManager({
          defaultPattern: PatternNames.ForwardConnection,
          patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]]),
          continueOnError: false
        });

        expect(() => {
          patternManager.applyPatterns({ schema: Project }, 'Project');
        }).toThrow();
      });
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration Tests", () => {
    it("should generate complete schema with forward connection pattern", async () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: {
    id: Scalars.ID,
    name: Scalars.String
  }
});

const Dashboard = defineObject('Dashboard', {
  fields: {
    id: Scalars.ID,
    title: Scalars.String
  }
});

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection,
  fieldName: 'dashboards',
  includeCount: true
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project,
  queries: {
    project: field({ id: Scalars.ID }, Project),
    projects: field({}, z.array(Project))
  }
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', {
          fields: {
            id: Scalars.ID,
            name: Scalars.String
          }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: {
            id: Scalars.ID,
            title: Scalars.String
          }
        });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection,
          fieldName: 'dashboards',
          includeCount: true
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.ForwardConnection,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project,
          queries: {
            project: field({ id: Scalars.ID }, Project),
            projects: field({}, z.array(Project))
          }
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('type Project {');
        expect(schema).toContain('type Dashboard {');
        expect(schema).toContain('dashboards(first: Int, after: String): DashboardConnection!');
        expect(schema).toContain('dashboardsCount: Int!');
        expect(schema).toContain('type DashboardConnection {');
        expect(schema).toContain('type DashboardEdge {');
        expect(schema).toContain('type PageInfo {');
        expect(schema).toContain('type Query {');
        expect(schema).toContain('project(id: ID!): Project!');
        expect(schema).toContain('projects: [Project!]!');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should generate complete schema with forward connection pattern');
      });
    });

    it("should handle multiple relationships in same schema", async () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const Dashboard = defineObject('Dashboard', {
  fields: { id: Scalars.ID, title: Scalars.String }
});

const User = defineObject('User', {
  fields: { id: Scalars.ID, email: Scalars.String }
});

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection,
  fieldName: 'dashboards'
});

defineRelationship(Project, RelationshipTypes.BelongsTo, User, {
  pattern: PatternNames.BackReferenceOnly,
  backReferenceFieldName: 'owner'
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([
      [PatternNames.ForwardConnection, forwardConnectionPattern],
      [PatternNames.BackReferenceOnly, backReferenceOnlyPattern]
    ])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID, name: Scalars.String }
        });

        const Dashboard = defineObject('Dashboard', {
          fields: { id: Scalars.ID, title: Scalars.String }
        });

        const User = defineObject('User', {
          fields: { id: Scalars.ID, email: Scalars.String }
        });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection,
          fieldName: 'dashboards'
        });

        defineRelationship(Project, RelationshipTypes.BelongsTo, User, {
          pattern: PatternNames.BackReferenceOnly,
          backReferenceFieldName: 'owner'
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.BackReferenceOnly,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('dashboards(first: Int, after: String): DashboardConnection!');
        expect(schema).toContain('type Dashboard {');
        expect(schema).toContain('project: Project!');
        expect(schema).toContain('type Project {');
        expect(schema).toContain('owner: User!');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should handle multiple relationships in same schema');
      });
    });

    it("should work without patterns applied (backward compatibility)", async () => {
      const zodqlCode = `
const Project = defineObject('Project', {
  fields: { id: Scalars.ID, name: Scalars.String }
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project,
  queries: {
    project: field({ id: Scalars.ID }, Project)
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', {
          fields: { id: Scalars.ID, name: Scalars.String }
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project,
          queries: {
            project: field({ id: Scalars.ID }, Project)
          }
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('type Project {');
        expect(schema).toContain('type Query {');
        expect(schema).toContain('project(id: ID!): Project!');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should work without patterns applied (backward compatibility)');
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe("Edge Cases and Error Handling", () => {
    it("should handle relationship with custom field names", async () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection,
  fieldName: 'myDashboards',
  backReferenceFieldName: 'myProject'
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection,
          fieldName: 'myDashboards',
          backReferenceFieldName: 'myProject'
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.ForwardConnection,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('myDashboards(');
        expect(schema).toContain('myProject: Project!');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should handle relationship with custom field names');
      });
    });

    it("should handle relationship with metadata", () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

const rel = defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection,
  metadata: {
    description: 'Project dashboards',
    resolverHint: 'useDataLoader'
  }
});

expect(rel.options.metadata.description).toBe('Project dashboards');
`;

      withTestCapture(zodqlCode, () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });

        const rel = defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection,
          metadata: {
            description: 'Project dashboards',
            resolverHint: 'useDataLoader'
          }
        });

        expect(rel.options.metadata.description).toBe('Project dashboards');
        expect(rel.options.metadata.resolverHint).toBe('useDataLoader');
      });
    });

    it("should handle PageInfo type reuse across multiple connections", async () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });
const Task = defineObject('Task', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
  pattern: PatternNames.ForwardConnection
});

defineRelationship(Project, RelationshipTypes.HasMany, Task, {
  pattern: PatternNames.ForwardConnection
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Dashboard = defineObject('Dashboard', { fields: { id: Scalars.ID } });
        const Task = defineObject('Task', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.HasMany, Dashboard, {
          pattern: PatternNames.ForwardConnection
        });

        defineRelationship(Project, RelationshipTypes.HasMany, Task, {
          pattern: PatternNames.ForwardConnection
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.ForwardConnection,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        // PageInfo should only appear once
        const pageInfoMatches = schema.match(/type PageInfo/g);
        expect(pageInfoMatches).toHaveLength(1);
        
        // But both connections should reference it
        expect(schema).toContain('DashboardConnection');
        expect(schema).toContain('TaskConnection');

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should handle PageInfo type reuse across multiple connections');
      });
    });

    it("should handle belongsToMany relationship type", async () => {
      const zodqlCode = `
const Project = defineObject('Project', { fields: { id: Scalars.ID } });
const Tag = defineObject('Tag', { fields: { id: Scalars.ID } });

defineRelationship(Project, RelationshipTypes.BelongsToMany, Tag, {
  pattern: PatternNames.ForwardConnection,
  fieldName: 'tags'
});

const generator = new GraphQLSchemaGenerator('Project', {
  schema: Project
}, {
  applyPatterns: true,
  patternManager: {
    patterns: new Map([[PatternNames.ForwardConnection, forwardConnectionPattern]])
  }
});

const schema = generator.generateSchemaFile();
`;

      await withTestCapture(zodqlCode, async () => {
        const Project = defineObject('Project', { fields: { id: Scalars.ID } });
        const Tag = defineObject('Tag', { fields: { id: Scalars.ID } });

        defineRelationship(Project, RelationshipTypes.BelongsToMany, Tag, {
          pattern: PatternNames.ForwardConnection,
          fieldName: 'tags'
        });

        // Use new extension-based approach
        const extension = createRelationshipPatternExtension({
          defaultPattern: PatternNames.ForwardConnection,
        });

        const generator = new GraphQLSchemaGenerator('Project', {
          schema: Project
        }, {
          extensions: [extension]
        });

        const schema = captureSchema(await generator.generateSchemaFile());

        expect(schema).toContain('tags(');
        expect(forwardConnectionPattern.supports(RelationshipTypes.BelongsToMany)).toBe(true);

        // Validate and lint the generated schema
        assertValidAndLinted(schema, 'should handle belongsToMany relationship type');
      });
    });
  });
});

