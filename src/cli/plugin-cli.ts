#!/usr/bin/env node

/**
 * =================================================================================
 * ZodQL Plugin CLI
 * =================================================================================
 *
 * Command-line interface for managing and running ZodQL plugins.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface PluginConfig {
  plugins?: Array<{
    name: string;
    options?: Record<string, any>;
  }>;
  workingDir?: string;
  continueOnError?: boolean;
  parallel?: boolean;
}

export class PluginCLI {
  private configPath: string;
  private config: PluginConfig;

  constructor(configPath: string = 'zodql.config.json') {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  /**
   * Main CLI entry point
   */
  async run(args: string[]): Promise<void> {
    // Skip 'plugin' if it's the first argument (when called directly)
    const normalizedArgs = args[0] === 'plugin' ? args.slice(1) : args;
    const command = normalizedArgs[0] || 'help';

    switch (command) {
      case 'list':
        await this.listPlugins();
        break;
      case 'run':
        await this.runPlugins(normalizedArgs.slice(1));
        break;
      case 'init':
        await this.initConfig();
        break;
      case 'add':
        await this.addPlugin(normalizedArgs[1], normalizedArgs.slice(2));
        break;
      case 'remove':
        await this.removePlugin(normalizedArgs[1]);
        break;
      case 'create':
        await this.createPlugin(normalizedArgs[1]);
        break;
      case 'search':
        await this.searchPlugins(normalizedArgs.slice(1));
        break;
      case 'help':
      default:
        this.showHelp();
        break;
    }
  }

  /**
   * List available plugins
   */
  private async listPlugins(): Promise<void> {
    console.log('\n📦 Configured ZodQL Plugins:\n');
    
    if (this.config.plugins && this.config.plugins.length > 0) {
      this.config.plugins.forEach((plugin, index) => {
        console.log(`${index + 1}. ${plugin.name}`);
        if (plugin.options) {
          console.log(`   Options: ${JSON.stringify(plugin.options)}`);
        }
        console.log();
      });
    } else {
      console.log('No plugins configured.');
      console.log('\nTo get started:');
      console.log('  1. Run "zodql plugin init" to create a configuration file');
      console.log('  2. Run "zodql plugin add <plugin-name>" to add plugins');
      console.log('  3. Run "zodql plugin run" to execute plugins\n');
    }
  }

  /**
   * Run plugins
   */
  private async runPlugins(args: string[]): Promise<void> {
    if (!this.config.plugins || this.config.plugins.length === 0) {
      console.error('❌ No plugins configured. Run "zodql plugin init" first.');
      process.exit(1);
    }

    console.log('\n🚀 Running plugins...\n');
    
    for (const plugin of this.config.plugins) {
      console.log(`  ✓ ${plugin.name}`);
      if (plugin.options) {
        console.log(`    Options: ${JSON.stringify(plugin.options)}`);
      }
    }

    console.log('\n✅ Plugins executed successfully!\n');
    console.log('Note: This is a placeholder. In a real implementation,');
    console.log('this would load and execute the actual plugins.\n');
  }

  /**
   * Initialize plugin configuration
   */
  private initConfig(): void {
    if (existsSync(this.configPath)) {
      console.log(`⚠️  Configuration file already exists: ${this.configPath}`);
      console.log('   Use "zodql plugin add <plugin>" to add plugins.\n');
      return;
    }

    const defaultConfig: PluginConfig = {
      plugins: [],
      workingDir: './generated',
      continueOnError: true,
      parallel: false,
    };

    writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`✅ Created configuration file: ${this.configPath}\n`);
    console.log('Next steps:');
    console.log('  1. Run "zodql plugin add <plugin-name>" to add plugins');
    console.log('  2. Run "zodql plugin run" to execute plugins\n');
  }

  /**
   * Add a plugin to configuration
   */
  private addPlugin(pluginName: string | undefined, options: string[]): void {
    if (!pluginName) {
      console.error('❌ Please specify a plugin name: zodql plugin add <plugin-name>');
      process.exit(1);
    }

    if (!this.config.plugins) {
      this.config.plugins = [];
    }

    // Parse options from command line
    const pluginOptions: Record<string, any> = {};
    for (let i = 0; i < options.length; i += 2) {
      const key = options[i]?.replace('--', '');
      const value = options[i + 1];
      if (key && value) {
        // Try to parse as JSON, fallback to string
        try {
          pluginOptions[key] = JSON.parse(value);
        } catch {
          pluginOptions[key] = value;
        }
      }
    }

    // Check if plugin already exists
    const existingIndex = this.config.plugins.findIndex(p => p.name === pluginName);
    if (existingIndex >= 0) {
      console.log(`⚠️  Plugin ${pluginName} already exists. Updating...`);
      this.config.plugins[existingIndex].options = {
        ...this.config.plugins[existingIndex].options,
        ...pluginOptions,
      };
    } else {
      this.config.plugins.push({
        name: pluginName,
        options: Object.keys(pluginOptions).length > 0 ? pluginOptions : undefined,
      });
    }

    this.saveConfig();
    console.log(`✅ Added plugin: ${pluginName}\n`);
  }

  /**
   * Remove a plugin from configuration
   */
  private removePlugin(pluginName: string | undefined): void {
    if (!pluginName) {
      console.error('❌ Please specify a plugin name: zodql plugin remove <plugin-name>');
      process.exit(1);
    }

    if (!this.config.plugins) {
      console.log('No plugins configured.\n');
      return;
    }

    const index = this.config.plugins.findIndex(p => p.name === pluginName);
    if (index < 0) {
      console.error(`❌ Plugin ${pluginName} not found.\n`);
      process.exit(1);
    }

    this.config.plugins.splice(index, 1);
    this.saveConfig();
    console.log(`✅ Removed plugin: ${pluginName}\n`);
  }

  /**
   * Create a new plugin template
   */
  private async createPlugin(pluginName: string | undefined): Promise<void> {
    if (!pluginName) {
      console.error('❌ Please specify a plugin name: zodql plugin create <plugin-name>');
      process.exit(1);
    }

    const pluginDir = join(process.cwd(), 'plugins', pluginName);
    if (existsSync(pluginDir)) {
      console.error(`❌ Directory already exists: ${pluginDir}`);
      process.exit(1);
    }

    mkdirSync(pluginDir, { recursive: true });

    // Create plugin file
    const pluginContent = `import type { ZodQLPlugin, PluginContext, PluginOutput } from 'zodql/plugins';

export class ${this.toPascalCase(pluginName)}Plugin implements ZodQLPlugin {
  metadata = {
    name: '${pluginName}',
    version: '1.0.0',
    description: 'Generated plugin',
  };

  constructor(private options: Record<string, any> = {}) {}

  generate(context: PluginContext): PluginOutput {
    // Your plugin logic here
    return {
      files: [],
      logs: ['Plugin executed'],
    };
  }
}
`;

    writeFileSync(join(pluginDir, 'index.ts'), pluginContent);

    // Create package.json
    const packageJson = {
      name: pluginName,
      version: '1.0.0',
      main: 'index.ts',
      keywords: ['zodql', 'zodql-plugin'],
      peerDependencies: {
        zodql: '*',
      },
    };

    writeFileSync(join(pluginDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create README
    const readme = `# ${pluginName}

ZodQL Plugin

## Installation

\`\`\`bash
npm install ${pluginName}
\`\`\`

## Usage

\`\`\`typescript
import { ${this.toPascalCase(pluginName)}Plugin } from '${pluginName}';

const plugin = new ${this.toPascalCase(pluginName)}Plugin({
  // options
});
\`\`\`
`;

    writeFileSync(join(pluginDir, 'README.md'), readme);

    console.log(`✅ Created plugin template: ${pluginDir}\n`);
    console.log('Next steps:');
    console.log(`  1. Edit ${join(pluginDir, 'index.ts')}`);
    console.log(`  2. Test your plugin`);
    console.log(`  3. Publish to npm\n`);
  }

  /**
   * Search for plugins on GitHub
   */
  private async searchPlugins(args: string[]): Promise<void> {
    const query = args[0] || 'zodql-plugin-*';
    const searchQuery = query.includes('*') ? query.replace('*', '') : query;

    console.log(`\n🔍 Searching GitHub for plugins matching "${query}"...\n`);

    try {
      // GitHub API search endpoint
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}+in:name+language:typescript&sort=stars&order=desc&per_page=20`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 403) {
          console.error('❌ GitHub API rate limit exceeded. Please try again later.\n');
          process.exit(1);
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        total_count: number;
        items: Array<{
          name: string;
          full_name: string;
          description: string | null;
          html_url: string;
          stargazers_count: number;
          updated_at: string;
          topics: string[];
        }>;
      };

      if (data.total_count === 0) {
        console.log('No plugins found matching your search.\n');
        console.log('Try:');
        console.log('  - zodql plugin search zodql-plugin-operations');
        console.log('  - zodql plugin search zodql-plugin-react\n');
        return;
      }

      console.log(`Found ${data.total_count} repository(ies). Showing top ${Math.min(data.items.length, 20)}:\n`);

      data.items.forEach((repo, index) => {
        const isPlugin = repo.name.startsWith('zodql-plugin-') || repo.topics.includes('zodql-plugin');
        
        if (isPlugin || query === 'zodql-plugin-*') {
          console.log(`${index + 1}. ${repo.name}`);
          if (repo.description) {
            console.log(`   ${repo.description}`);
          }
          console.log(`   ⭐ ${repo.stargazers_count} stars | 📅 Updated ${new Date(repo.updated_at).toLocaleDateString()}`);
          console.log(`   🔗 ${repo.html_url}`);
          if (repo.topics.length > 0) {
            console.log(`   🏷️  ${repo.topics.join(', ')}`);
          }
          console.log();
        }
      });

      console.log('To add a plugin:');
      console.log(`  zodql plugin add ${data.items[0]?.name || '<plugin-name>'} [options]\n`);

    } catch (error) {
      console.error('❌ Error searching GitHub:');
      if (error instanceof Error) {
        console.error(`   ${error.message}\n`);
      } else {
        console.error(`   ${String(error)}\n`);
      }
      console.log('Make sure you have an internet connection and GitHub API is accessible.\n');
      process.exit(1);
    }
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(`
🔌 ZodQL Plugin CLI

Usage: zodql plugin <command> [options]

Commands:
  list              List configured plugins
  run               Run configured plugins
  init              Initialize plugin configuration
  add <name>        Add a plugin to configuration
  remove <name>     Remove a plugin from configuration
  create <name>     Create a new plugin template
  search [query]    Search for plugins on GitHub (default: zodql-plugin-*)
  help              Show this help message

Examples:
  zodql plugin init
  zodql plugin search
  zodql plugin search zodql-plugin-operations
  zodql plugin add zodql-plugin-operations --outputDir ./generated
  zodql plugin run
  zodql plugin create my-plugin

For more information, visit: https://github.com/your-org/zodql
`);
  }

  /**
   * Load configuration file
   */
  private loadConfig(): PluginConfig {
    if (!existsSync(this.configPath)) {
      return {};
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Error loading config: ${error}`);
      return {};
    }
  }

  /**
   * Save configuration file
   */
  private saveConfig(): void {
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}

// CLI entry point
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('plugin-cli.ts') ||
                     process.argv[1]?.endsWith('plugin-cli.js');

if (isMainModule || process.argv[0]?.includes('tsx') || process.argv[0]?.includes('node')) {
  const cli = new PluginCLI();
  cli.run(process.argv.slice(2)).catch(console.error);
}
