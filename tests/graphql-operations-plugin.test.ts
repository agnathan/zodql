import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { z } from 'zod';
import { GraphQLSchemaGenerator } from '../src/generators/GraphQLSchemaGenerator.js';
import { PluginManager } from '../src/plugins/PluginManager.js';
import { GraphQLOperationsPlugin } from '../src/plugins/examples/GraphQLOperationsPlugin.js';
import { defineObject, defineInput, defineEnum, field, Scalars, Registry } from '../src/zodql/index.js';
import {
  captureTestInput,
  captureTestOutput,
  captureTestError,
  finalizeTest,
  writeTestSummaries,
  setDescribeBlock,
} from '../src/test-reporter.js';

// Store current test context
let currentTestName: string | undefined;

// Helper to capture plugin output
function capturePluginOutput(output: string) {
  if (currentTestName) {
    captureTestOutput(output);
  }
  return output;
}

// Helper to format plugin results for test reporting
function formatPluginResults(results: any[]): string {
  const output: string[] = [];
  
  for (const result of results) {
    if (result.success) {
      output.push(`\n=== Plugin: ${result.plugin.name} ===`);
      output.push(`Status: SUCCESS`);
      output.push(`Duration: ${result.duration}ms`);
      
      if (result.output.files && result.output.files.length > 0) {
        output.push('\n--- Generated Files ---');
        for (const file of result.output.files) {
          output.push(`\n${file.path}:`);
          output.push(file.content);
        }
      }
      
      if (result.output.logs && result.output.logs.length > 0) {
        output.push('\n--- Logs ---');
        result.output.logs.forEach((log: string) => output.push(log));
      }
      
      if (result.output.metadata) {
        output.push('\n--- Metadata ---');
        output.push(JSON.stringify(result.output.metadata, null, 2));
      }
    } else {
      output.push(`\n=== Plugin: ${result.plugin.name} ===`);
      output.push(`Status: FAILED`);
      output.push(`Error: ${result.error?.message || 'Unknown error'}`);
      if (result.output.errors) {
        result.output.errors.forEach((err: string) => output.push(`  - ${err}`));
      }
    }
  }
  
  return output.join('\n');
}

// Helper to wrap tests with automatic input/output capture
async function withTestCapture(zodqlCode: string, testFn: () => void | Promise<void>) {
  if (!currentTestName) {
    throw new Error('Test name not set. Make sure beforeEach is running.');
  }

  captureTestInput(currentTestName, zodqlCode);
  let passed = false;

  try {
    const result = testFn();
    if (result instanceof Promise) {
      await result;
    }
    passed = true;
    finalizeTest(passed);
  } catch (error: any) {
    captureTestError(error.message || String(error));
    finalizeTest(passed);
    throw error;
  }
}

describe('GraphQLOperationsPlugin', () => {
  let generator: GraphQLSchemaGenerator;
  let pluginManager: PluginManager;

  beforeEach((ctx) => {
    pluginManager = new PluginManager({ workingDir: './test-generated' });
    // Clear registry by removing all entries
    for (const key of Registry.keys()) {
      Registry.delete(key);
    }
    // Capture test name from context
    currentTestName = ctx.task?.name;
    // Capture describe block name from suite hierarchy
    let suite = ctx.task?.suite;
    // Traverse up the suite tree to find the immediate describe block
    // (skip the root suite and find the first named suite)
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

  describe('Validation', () => {
    it('should validate successfully when queries exist', () => {
      const User = defineObject('User', {
        fields: {
          id: Scalars.ID,
          name: Scalars.String,
        },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      const plugin = new GraphQLOperationsPlugin();
      const context = {
        generator,
        config: generator.config,
        entityName: 'User',
        registry: Registry,
      };

      const result = plugin.validate!(context);
      expect(result).toBe(true);
    });

    it('should validate successfully when mutations exist', () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const CreateUserInput = defineInput('CreateUserInput', {
        name: Scalars.String,
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        mutations: {
          createUser: field({ input: CreateUserInput }, User),
        },
      });

      const plugin = new GraphQLOperationsPlugin();
      const context = {
        generator,
        config: generator.config,
        entityName: 'User',
        registry: Registry,
      };

      const result = plugin.validate!(context);
      expect(result).toBe(true);
    });

    it('should validate successfully when subscriptions exist', () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        subscriptions: {
          userUpdated: field({ id: Scalars.ID }, User),
        },
      });

      const plugin = new GraphQLOperationsPlugin();
      const context = {
        generator,
        config: generator.config,
        entityName: 'User',
        registry: Registry,
      };

      const result = plugin.validate!(context);
      expect(result).toBe(true);
    });

    it('should fail validation when no operations exist', () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
      });

      const plugin = new GraphQLOperationsPlugin();
      const context = {
        generator,
        config: generator.config,
        entityName: 'User',
        registry: Registry,
      };

      const result = plugin.validate!(context);
      expect(result).toBe('No operations found in schema (queries, mutations, or subscriptions)');
    });
  });

  describe('Query Generation', () => {
    it('should generate query operation without arguments', async () => {
      const zodqlCode = `
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    name: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  queries: {
    listUsers: field({}, z.array(User)),
  },
});

const plugin = new GraphQLOperationsPlugin();
const results = await pluginManager.runPlugins(generator);
`.trim();

      await withTestCapture(zodqlCode, async () => {
        const User = defineObject('User', {
          fields: {
            id: Scalars.ID,
            name: Scalars.String,
          },
        });

        const generator = new GraphQLSchemaGenerator('User', {
          schema: User,
          queries: {
            listUsers: field({}, z.array(User)),
          },
        });

        pluginManager.register(new GraphQLOperationsPlugin());
        const results = await pluginManager.runPlugins(generator);

        expect(results[0].success).toBe(true);
        expect(results[0].output.files).toHaveLength(2); // operations.ts and operation-types.ts

        const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
        expect(operationsFile).toBeDefined();
        expect(operationsFile!.content).toContain('query ListUsers');
        expect(operationsFile!.content).toContain('listUsers');

        // Capture output for test reporting
        capturePluginOutput(formatPluginResults(results));
      });
    });

    it('should generate query operation with arguments', async () => {
      const zodqlCode = `
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    name: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  queries: {
    getUser: field({ id: Scalars.ID }, User),
  },
});

const plugin = new GraphQLOperationsPlugin();
const results = await pluginManager.runPlugins(generator);
`.trim();

      await withTestCapture(zodqlCode, async () => {
        const User = defineObject('User', {
          fields: {
            id: Scalars.ID,
            name: Scalars.String,
          },
        });

        const generator = new GraphQLSchemaGenerator('User', {
          schema: User,
          queries: {
            getUser: field({ id: Scalars.ID }, User),
          },
        });

        pluginManager.register(new GraphQLOperationsPlugin());
        const results = await pluginManager.runPlugins(generator);

        expect(results[0].success).toBe(true);
        const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
        expect(operationsFile!.content).toContain('query GetUser($id: ID!)');
        expect(operationsFile!.content).toContain('getUser(id: $id)');

        capturePluginOutput(formatPluginResults(results));
      });
    });

    it('should generate query with optional arguments', async () => {
      const zodqlCode = `
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    name: Scalars.String,
  },
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  queries: {
    searchUsers: field({ 
      query: Scalars.String.optional(),
      limit: Scalars.Int.optional(),
    }, z.array(User)),
  },
});

const plugin = new GraphQLOperationsPlugin();
const results = await pluginManager.runPlugins(generator);
`.trim();

      await withTestCapture(zodqlCode, async () => {
        const User = defineObject('User', {
          fields: {
            id: Scalars.ID,
            name: Scalars.String,
          },
        });

        const generator = new GraphQLSchemaGenerator('User', {
          schema: User,
          queries: {
            searchUsers: field({ 
              query: Scalars.String.optional(),
              limit: Scalars.Int.optional(),
            }, z.array(User)),
          },
        });

        pluginManager.register(new GraphQLOperationsPlugin());
        const results = await pluginManager.runPlugins(generator);

        expect(results[0].success).toBe(true);
        const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types.ts'));
        expect(typesFile).toBeDefined();
        expect(typesFile!.content).toContain('SearchUsersVariables');
        expect(typesFile!.content).toMatch(/query\?: string/);
        expect(typesFile!.content).toMatch(/limit\?: number/);

        capturePluginOutput(formatPluginResults(results));
      });
    });
  });

  describe('Mutation Generation', () => {
    it('should generate mutation operation', async () => {
      const zodqlCode = `
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    name: Scalars.String,
  },
});

const CreateUserInput = defineInput('CreateUserInput', {
  name: Scalars.String,
  email: Scalars.String,
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  inputs: {
    create: CreateUserInput,
  },
  mutations: {
    createUser: field({ input: CreateUserInput }, User),
  },
});

const plugin = new GraphQLOperationsPlugin();
const results = await pluginManager.runPlugins(generator);
`.trim();

      await withTestCapture(zodqlCode, async () => {
        const User = defineObject('User', {
          fields: {
            id: Scalars.ID,
            name: Scalars.String,
          },
        });

        const CreateUserInput = defineInput('CreateUserInput', {
          name: Scalars.String,
          email: Scalars.String,
        });

        const generator = new GraphQLSchemaGenerator('User', {
          schema: User,
          inputs: {
            create: CreateUserInput,
          },
          mutations: {
            createUser: field({ input: CreateUserInput }, User),
          },
        });

        pluginManager.register(new GraphQLOperationsPlugin());
        const results = await pluginManager.runPlugins(generator);

        expect(results[0].success).toBe(true);
        const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
        expect(operationsFile!.content).toContain('mutation CreateUser');
        expect(operationsFile!.content).toContain('createUser(input: $input)');

        capturePluginOutput(formatPluginResults(results));
      });
    });

    it('should generate mutation with multiple arguments', async () => {
      const User = defineObject('User', {
        fields: {
          id: Scalars.ID,
          name: Scalars.String,
        },
      });

      const UpdateUserInput = defineInput('UpdateUserInput', {
        name: Scalars.String.optional(),
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        inputs: {
          update: UpdateUserInput,
        },
        mutations: {
          updateUser: field({ id: Scalars.ID, input: UpdateUserInput }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
      expect(operationsFile!.content).toContain('mutation UpdateUser');
      expect(operationsFile!.content).toContain('$id: ID!');
      expect(operationsFile!.content).toContain('$input: UpdateUserInput!');
    });
  });

  describe('Subscription Generation', () => {
    it('should generate subscription operation', async () => {
      const User = defineObject('User', {
        fields: {
          id: Scalars.ID,
          name: Scalars.String,
        },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        subscriptions: {
          userUpdated: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
      expect(operationsFile!.content).toContain('subscription UserUpdated');
      expect(operationsFile!.content).toContain('userUpdated(id: $id)');
    });
  });

  describe('Type Generation', () => {
    it('should generate TypeScript types for operations', async () => {
      const User = defineObject('User', {
        fields: {
          id: Scalars.ID,
          name: Scalars.String,
        },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin({ generateTypes: true }));
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types.ts'));
      expect(typesFile).toBeDefined();
      expect(typesFile!.content).toContain('export interface GetUserVariables');
      expect(typesFile!.content).toContain('export interface GetUserResponse');
      expect(typesFile!.content).toContain('id: string');
      expect(typesFile!.content).toContain('getUser: User');
    });

    it('should not generate types when generateTypes is false', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin({ generateTypes: false }));
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types'));
      expect(typesFile).toBeUndefined();
    });
  });

  describe('Document Generation', () => {
    it('should generate operation documents by default', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
      expect(operationsFile).toBeDefined();
    });

    it('should not generate documents when generateDocuments is false', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin({ generateDocuments: false }));
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations'));
      expect(operationsFile).toBeUndefined();
    });
  });

  describe('Output Format', () => {
    it('should generate TypeScript files by default', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin({ format: 'typescript' }));
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
      expect(operationsFile).toBeDefined();
    });

    it('should generate JavaScript files when format is javascript', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin({ format: 'javascript' }));
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.js'));
      expect(operationsFile).toBeDefined();
      const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types'));
      expect(typesFile).toBeUndefined(); // No types for JS
    });
  });

  describe('Output Directory', () => {
    it('should use custom output directory', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin({ outputDir: './custom-output' }));
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
      expect(operationsFile!.path).toContain('custom-output');
    });

    it('should use workingDir when outputDir is not specified', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      const manager = new PluginManager({ workingDir: './test-working-dir' });
      manager.register(new GraphQLOperationsPlugin());
      const results = await manager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
      expect(operationsFile!.path).toContain('test-working-dir');
    });
  });

  describe('Complex Types', () => {
    it('should handle array return types', async () => {
      const User = defineObject('User', {
        fields: {
          id: Scalars.ID,
          name: Scalars.String,
        },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          listUsers: field({}, z.array(User)),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types.ts'));
      expect(typesFile!.content).toContain('listUsers: User[]');
    });

    it('should handle enum types', async () => {
      const Status = defineEnum('Status', ['ACTIVE', 'INACTIVE', 'PENDING']);
      const User = defineObject('User', {
        fields: {
          id: Scalars.ID,
          status: Status,
        },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUsersByStatus: field({ status: Status }, z.array(User)),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types.ts'));
      expect(typesFile!.content).toContain('status: Status');
    });

    it('should handle nested input types', async () => {
      const AddressInput = defineInput('AddressInput', {
        street: Scalars.String,
        city: Scalars.String,
      });

      const CreateUserInput = defineInput('CreateUserInput', {
        name: Scalars.String,
        address: AddressInput,
      });

      const User = defineObject('User', {
        fields: {
          id: Scalars.ID,
          name: Scalars.String,
        },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        inputs: {
          create: CreateUserInput,
          address: AddressInput,
        },
        mutations: {
          createUser: field({ input: CreateUserInput }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types.ts'));
      expect(typesFile!.content).toContain('input: CreateUserInput');
    });
  });

  describe('Multiple Operations', () => {
    it('should generate all operations when multiple exist', async () => {
      const zodqlCode = `
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    name: Scalars.String,
  },
});

const CreateUserInput = defineInput('CreateUserInput', {
  name: Scalars.String,
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  inputs: {
    create: CreateUserInput,
  },
  queries: {
    getUser: field({ id: Scalars.ID }, User),
    listUsers: field({}, z.array(User)),
  },
  mutations: {
    createUser: field({ input: CreateUserInput }, User),
  },
  subscriptions: {
    userUpdated: field({ id: Scalars.ID }, User),
  },
});

const plugin = new GraphQLOperationsPlugin();
const results = await pluginManager.runPlugins(generator);
`.trim();

      await withTestCapture(zodqlCode, async () => {
        const User = defineObject('User', {
          fields: {
            id: Scalars.ID,
            name: Scalars.String,
          },
        });

        const CreateUserInput = defineInput('CreateUserInput', {
          name: Scalars.String,
        });

        const generator = new GraphQLSchemaGenerator('User', {
          schema: User,
          inputs: {
            create: CreateUserInput,
          },
          queries: {
            getUser: field({ id: Scalars.ID }, User),
            listUsers: field({}, z.array(User)),
          },
          mutations: {
            createUser: field({ input: CreateUserInput }, User),
          },
          subscriptions: {
            userUpdated: field({ id: Scalars.ID }, User),
          },
        });

        pluginManager.register(new GraphQLOperationsPlugin());
        const results = await pluginManager.runPlugins(generator);

        expect(results[0].success).toBe(true);
        expect(results[0].output.metadata?.operationCount).toBe(4);
        
        const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
        expect(operationsFile!.content).toContain('query GetUser');
        expect(operationsFile!.content).toContain('query ListUsers');
        expect(operationsFile!.content).toContain('mutation CreateUser');
        expect(operationsFile!.content).toContain('subscription UserUpdated');

        capturePluginOutput(formatPluginResults(results));
      });
    });
  });

  describe('Metadata and Logs', () => {
    it('should include correct metadata in output', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      expect(results[0].output.metadata).toBeDefined();
      expect(results[0].output.metadata?.operationCount).toBe(1);
      expect(results[0].output.metadata?.entityName).toBe('User');
      expect(results[0].output.metadata?.format).toBe('typescript');
    });

    it('should include logs in output', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      expect(results[0].output.logs).toBeDefined();
      expect(results[0].output.logs!.length).toBeGreaterThan(0);
      expect(results[0].output.logs![0]).toContain('Generated');
      expect(results[0].output.logs![0]).toContain('User');
    });
  });

  describe('Edge Cases', () => {
    it('should handle operations with no arguments', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getCurrentUser: field({}, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
      expect(operationsFile!.content).toContain('query GetCurrentUser');
      expect(operationsFile!.content).not.toContain('$'); // No variables
    });

    it('should handle operations returning scalars', async () => {
      const generator = new GraphQLSchemaGenerator('User', {
        schema: defineObject('User', { fields: { id: Scalars.ID } }),
        mutations: {
          deleteUser: field({ id: Scalars.ID }, Scalars.Boolean),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types.ts'));
      expect(typesFile!.content).toContain('deleteUser: boolean');
    });

    it('should handle nullable return types', async () => {
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          findUser: field({ id: Scalars.ID }, User.nullable()),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types.ts'));
      expect(typesFile!.content).toContain('findUser: User | null');
    });
  });

  describe('File Content Validation', () => {
    it('should generate valid GraphQL operation syntax', async () => {
      const User = defineObject('User', {
        fields: {
          id: Scalars.ID,
          name: Scalars.String,
        },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const operationsFile = results[0].output.files!.find(f => f.path.includes('operations.ts'));
      
      // Validate GraphQL syntax structure
      expect(operationsFile!.content).toMatch(/query\s+\w+/);
      expect(operationsFile!.content).toContain('{');
      expect(operationsFile!.content).toContain('}');
    });

    it('should generate valid TypeScript type syntax', async () => {
      const User = defineObject('User', {
        fields: {
          id: Scalars.ID,
          name: Scalars.String,
        },
      });

      const generator = new GraphQLSchemaGenerator('User', {
        schema: User,
        queries: {
          getUser: field({ id: Scalars.ID }, User),
        },
      });

      pluginManager.register(new GraphQLOperationsPlugin());
      const results = await pluginManager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      const typesFile = results[0].output.files!.find(f => f.path.includes('operation-types.ts'));
      
      // Validate TypeScript syntax
      expect(typesFile!.content).toContain('export interface');
      expect(typesFile!.content).toMatch(/Variables\s*\{/);
      expect(typesFile!.content).toMatch(/Response\s*\{/);
    });
  });
});
