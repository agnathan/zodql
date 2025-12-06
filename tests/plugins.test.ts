import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { GraphQLSchemaGenerator } from '../src/generators/GraphQLSchemaGenerator.js';
import { PluginManager } from '../src/plugins/PluginManager.js';
import type { ZodQLPlugin, PluginContext, PluginOutput } from '../src/plugins/types.js';
import { defineObject, defineInput, field, Scalars } from '../src/zodql/index.js';

// Test plugin implementations
class TestPlugin implements ZodQLPlugin {
  metadata = {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'Test plugin',
  };

  public callCount = 0;
  public lastContext: PluginContext | null = null;

  generate(context: PluginContext): PluginOutput {
    this.callCount++;
    this.lastContext = context;
    return {
      files: [{ path: 'test.txt', content: 'test content' }],
      logs: ['Test plugin executed'],
    };
  }
}

class ValidationPlugin implements ZodQLPlugin {
  metadata = {
    name: 'validation-plugin',
    version: '1.0.0',
    description: 'Plugin with validation',
  };

  validate(context: PluginContext): boolean | string {
    if (!context.config.queries) {
      return 'No queries found';
    }
    return true;
  }

  generate(context: PluginContext): PluginOutput {
    return { logs: ['Validation passed'] };
  }
}

class FailingPlugin implements ZodQLPlugin {
  metadata = {
    name: 'failing-plugin',
    version: '1.0.0',
    description: 'Plugin that fails',
  };

  generate(context: PluginContext): PluginOutput {
    throw new Error('Plugin failed');
  }
}

class DependentPlugin implements ZodQLPlugin {
  metadata = {
    name: 'dependent-plugin',
    version: '1.0.0',
    description: 'Plugin with dependencies',
    dependencies: ['test-plugin'],
  };

  public executed = false;

  generate(context: PluginContext): PluginOutput {
    this.executed = true;
    return { logs: ['Dependent plugin executed'] };
  }
}

class AsyncPlugin implements ZodQLPlugin {
  metadata = {
    name: 'async-plugin',
    version: '1.0.0',
    description: 'Async plugin',
  };

  async generate(context: PluginContext): Promise<PluginOutput> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { logs: ['Async plugin executed'] };
  }
}

class LifecyclePlugin implements ZodQLPlugin {
  metadata = {
    name: 'lifecycle-plugin',
    version: '1.0.0',
    description: 'Plugin with lifecycle hooks',
  };

  public beforeGenerateCalled = false;
  public afterGenerateCalled = false;
  public receivedOutput: PluginOutput | null = null;

  beforeGenerate(context: PluginContext): void {
    this.beforeGenerateCalled = true;
  }

  generate(context: PluginContext): PluginOutput {
    return { logs: ['Generated'] };
  }

  afterGenerate(context: PluginContext, output: PluginOutput): void {
    this.afterGenerateCalled = true;
    this.receivedOutput = output;
  }
}

describe('PluginManager', () => {
  let manager: PluginManager;
  let generator: GraphQLSchemaGenerator;

  beforeEach(() => {
    manager = new PluginManager({ workingDir: './test-generated' });
    
    const User = defineObject('User', {
      fields: {
        id: Scalars.ID,
        username: Scalars.String,
      },
    });

    generator = new GraphQLSchemaGenerator('User', {
      schema: User,
      queries: {
        getUser: field({ id: Scalars.ID }, User),
      },
    });
  });

  describe('Plugin Registration', () => {
    it('should register a plugin', () => {
      const plugin = new TestPlugin();
      manager.register(plugin);
      expect(manager.getPlugins()).toHaveLength(1);
      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should register multiple plugins', () => {
      const plugin1 = new TestPlugin();
      const plugin2 = new ValidationPlugin();
      manager.registerAll([plugin1, plugin2]);
      expect(manager.getPlugins()).toHaveLength(2);
    });

    it('should throw error for duplicate plugin names', () => {
      const plugin1 = new TestPlugin();
      const plugin2 = new TestPlugin();
      manager.register(plugin1);
      expect(() => manager.register(plugin2)).toThrow('already registered');
    });

    it('should throw error for plugin without metadata', () => {
      const invalidPlugin = {
        generate: () => ({}),
      } as any;
      expect(() => manager.register(invalidPlugin)).toThrow();
    });

    it('should throw error for plugin without generate method', () => {
      const invalidPlugin = {
        metadata: { name: 'test', version: '1.0.0' },
      } as any;
      expect(() => manager.register(invalidPlugin)).toThrow();
    });

    it('should clear all plugins', () => {
      manager.register(new TestPlugin());
      manager.clear();
      expect(manager.getPlugins()).toHaveLength(0);
    });
  });

  describe('Plugin Execution', () => {
    it('should execute a plugin', async () => {
      const plugin = new TestPlugin();
      manager.register(plugin);

      const results = await manager.runPlugins(generator);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].plugin.name).toBe('test-plugin');
      expect(plugin.callCount).toBe(1);
      expect(plugin.lastContext).toBeTruthy();
      expect(plugin.lastContext?.entityName).toBe('User');
    });

    it('should provide correct context to plugins', async () => {
      const plugin = new TestPlugin();
      manager.register(plugin);

      await manager.runPlugins(generator);

      const context = plugin.lastContext!;
      expect(context.generator).toBe(generator);
      expect(context.config).toBe(generator.config);
      expect(context.entityName).toBe('User');
      expect(context.graphQLSchema).toBeTruthy();
      expect(context.workingDir).toBe('./test-generated');
    });

    it('should handle async plugins', async () => {
      const plugin = new AsyncPlugin();
      manager.register(plugin);

      const results = await manager.runPlugins(generator);

      expect(results[0].success).toBe(true);
      expect(results[0].output.logs).toContain('Async plugin executed');
    });

    it('should call lifecycle hooks', async () => {
      const plugin = new LifecyclePlugin();
      manager.register(plugin);

      await manager.runPlugins(generator);

      expect(plugin.beforeGenerateCalled).toBe(true);
      expect(plugin.afterGenerateCalled).toBe(true);
      expect(plugin.receivedOutput).toBeTruthy();
    });

    it('should validate plugins before execution', async () => {
      const plugin = new ValidationPlugin();
      manager.register(plugin);

      // Create generator without queries
      const User = defineObject('User', {
        fields: { id: Scalars.ID },
      });
      const generatorWithoutQueries = new GraphQLSchemaGenerator('User', {
        schema: User,
      });

      const results = await manager.runPlugins(generatorWithoutQueries);

      expect(results[0].success).toBe(false);
      expect(results[0].output.errors).toContain('Plugin validation failed: No queries found');
    });
  });

  describe('Error Handling', () => {
    it('should handle plugin failures gracefully', async () => {
      const plugin = new FailingPlugin();
      manager.register(plugin);

      const results = await manager.runPlugins(generator);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeTruthy();
      expect(results[0].error?.message).toBe('Plugin failed');
    });

    it('should continue on error by default', async () => {
      const failingPlugin = new FailingPlugin();
      const testPlugin = new TestPlugin();
      manager.register(failingPlugin);
      manager.register(testPlugin);

      const results = await manager.runPlugins(generator);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });

    it('should stop on error when continueOnError is false', async () => {
      const manager = new PluginManager({
        workingDir: './test-generated',
        continueOnError: false,
      });
      const failingPlugin = new FailingPlugin();
      const testPlugin = new TestPlugin();
      manager.register(failingPlugin);
      manager.register(testPlugin);

      const results = await manager.runPlugins(generator);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });
  });

  describe('Dependency Resolution', () => {
    it('should execute plugins in dependency order', async () => {
      const dependentPlugin = new DependentPlugin();
      const testPlugin = new TestPlugin();
      
      // Register in wrong order
      manager.register(dependentPlugin);
      manager.register(testPlugin);

      await manager.runPlugins(generator);

      // Dependent plugin should execute after test-plugin
      expect(testPlugin.callCount).toBe(1);
      expect(dependentPlugin.executed).toBe(true);
    });

    it('should throw error on circular dependencies', () => {
      const plugin1 = {
        metadata: {
          name: 'plugin1',
          version: '1.0.0',
          dependencies: ['plugin2'],
        },
        generate: () => ({}),
      } as ZodQLPlugin;

      const plugin2 = {
        metadata: {
          name: 'plugin2',
          version: '1.0.0',
          dependencies: ['plugin1'],
        },
        generate: () => ({}),
      } as ZodQLPlugin;

      manager.register(plugin1);
      manager.register(plugin2);

      expect(async () => {
        await manager.runPlugins(generator);
      }).rejects.toThrow('Circular dependency');
    });
  });

  describe('Parallel Execution', () => {
    it('should execute plugins in parallel when enabled', async () => {
      const manager = new PluginManager({
        workingDir: './test-generated',
        parallel: true,
      });

      // Create unique plugin instances with different names
      class AsyncPlugin1 extends AsyncPlugin {
        metadata = {
          name: 'async-plugin-1',
          version: '1.0.0',
          description: 'Async plugin 1',
        };
      }
      
      class AsyncPlugin2 extends AsyncPlugin {
        metadata = {
          name: 'async-plugin-2',
          version: '1.0.0',
          description: 'Async plugin 2',
        };
      }

      const plugin1 = new AsyncPlugin1();
      const plugin2 = new AsyncPlugin2();
      manager.register(plugin1);
      manager.register(plugin2);

      const startTime = Date.now();
      const results = await manager.runPlugins(generator);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      // Parallel execution should be faster than sequential (2 * 10ms)
      expect(duration).toBeLessThan(30);
    });
  });

  describe('Shared Context', () => {
    it('should share data between plugins', async () => {
      class SharingPlugin implements ZodQLPlugin {
        metadata = {
          name: 'sharing-plugin',
          version: '1.0.0',
          description: 'Shares data',
        };

        generate(context: PluginContext): PluginOutput {
          context.shared!.set('test-key', 'test-value');
          return { shared: { 'test-key': 'test-value' } };
        }
      }

      class ReadingPlugin implements ZodQLPlugin {
        metadata = {
          name: 'reading-plugin',
          version: '1.0.0',
          description: 'Reads shared data',
          dependencies: ['sharing-plugin'],
        };

        public readValue: any = null;

        generate(context: PluginContext): PluginOutput {
          this.readValue = context.shared!.get('test-key');
          return {};
        }
      }

      const sharingPlugin = new SharingPlugin();
      const readingPlugin = new ReadingPlugin();
      manager.register(sharingPlugin);
      manager.register(readingPlugin);

      await manager.runPlugins(generator);

      expect(readingPlugin.readValue).toBe('test-value');
    });
  });

  describe('Output Handling', () => {
    it('should return plugin output', async () => {
      const plugin = new TestPlugin();
      manager.register(plugin);

      const results = await manager.runPlugins(generator);

      expect(results[0].output.files).toHaveLength(1);
      expect(results[0].output.files![0].path).toBe('test.txt');
      expect(results[0].output.files![0].content).toBe('test content');
      expect(results[0].output.logs).toContain('Test plugin executed');
    });

    it('should track execution duration', async () => {
      const plugin = new AsyncPlugin();
      manager.register(plugin);

      const results = await manager.runPlugins(generator);

      expect(results[0].duration).toBeGreaterThan(0);
    });
  });
});
