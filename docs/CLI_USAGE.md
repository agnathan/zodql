# ZodQL Plugin CLI Usage Guide

## Installation

The CLI is included with ZodQL. After installing ZodQL, you can use it via:

```bash
npx zodql plugin <command>
```

Or if installed globally:

```bash
zodql plugin <command>
```

## Commands

### `init`

Initialize a plugin configuration file (`zodql.config.json`).

```bash
zodql plugin init
```

Creates a default configuration file with:
- Empty plugins array
- Working directory: `./generated`
- Continue on error: `true`
- Parallel execution: `false`

### `list`

List all available and configured plugins.

```bash
zodql plugin list
```

Shows:
- Built-in plugins (operations, react-query, openapi)
- Configured plugins from your config file

### `add`

Add a plugin to your configuration.

```bash
zodql plugin add <plugin-name> [options]
```

Examples:
```bash
# Add operations plugin
zodql plugin add zodql-plugin-operations

# Add plugin with options
zodql plugin add zodql-plugin-operations --outputDir ./generated --format typescript

# Options are parsed as JSON when possible, otherwise as strings
zodql plugin add zodql-plugin-react-query --reactQueryVersion v5 --generateTypes true
```

### `remove`

Remove a plugin from your configuration.

```bash
zodql plugin remove <plugin-name>
```

Example:
```bash
zodql plugin remove zodql-plugin-operations
```

### `run`

Execute all configured plugins.

```bash
zodql plugin run
```

Runs all plugins listed in your `zodql.config.json` file.

### `create`

Create a new plugin template.

```bash
zodql plugin create <plugin-name>
```

Creates a new plugin directory with:
- `index.ts` - Plugin implementation template
- `package.json` - Package configuration
- `README.md` - Plugin documentation template

Example:
```bash
zodql plugin create my-custom-plugin
```

This creates:
```
plugins/
└── my-custom-plugin/
    ├── index.ts
    ├── package.json
    └── README.md
```

### `help`

Show help message.

```bash
zodql plugin help
```

## Configuration File

The CLI uses `zodql.config.json` in your project root:

```json
{
  "plugins": [
    {
      "name": "zodql-plugin-operations",
      "options": {
        "outputDir": "./generated",
        "format": "typescript"
      }
    }
  ],
  "workingDir": "./generated",
  "continueOnError": true,
  "parallel": false
}
```

### Configuration Options

- **`plugins`**: Array of plugin configurations
  - **`name`**: Plugin name (required)
  - **`options`**: Plugin-specific options (optional)
- **`workingDir`**: Default working directory for file generation
- **`continueOnError`**: Whether to continue executing plugins if one fails
- **`parallel`**: Whether to execute plugins in parallel

## Examples

### Complete Workflow

```bash
# 1. Initialize configuration
zodql plugin init

# 2. Add plugins
zodql plugin add zodql-plugin-operations --outputDir ./generated/operations
zodql plugin add zodql-plugin-react-query --outputDir ./generated/hooks

# 3. List configured plugins
zodql plugin list

# 4. Run plugins
zodql plugin run
```

### Creating a Custom Plugin

```bash
# 1. Create plugin template
zodql plugin create my-graphql-client

# 2. Edit plugins/my-graphql-client/index.ts
# 3. Test your plugin
# 4. Publish to npm
```

## Integration with Build Tools

### npm scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "generate": "zodql plugin run",
    "plugin:add": "zodql plugin add",
    "plugin:list": "zodql plugin list"
  }
}
```

### CI/CD

```yaml
# GitHub Actions example
- name: Generate code
  run: |
    npm install
    zodql plugin run
```

## Troubleshooting

### Plugin not found

If you get "Plugin not found" errors:
1. Make sure the plugin is installed: `npm install <plugin-name>`
2. Check plugin name matches exactly
3. Verify plugin exports the correct class

### Configuration errors

If configuration file has errors:
1. Validate JSON syntax
2. Check plugin names are correct
3. Verify option names match plugin's expected options

### Permission errors

On Unix systems, you may need to make the CLI executable:

```bash
chmod +x node_modules/.bin/zodql
```

## Advanced Usage

### Programmatic API

You can also use the CLI programmatically:

```typescript
import { PluginCLI } from 'zodql/cli';

const cli = new PluginCLI('custom-config.json');
await cli.run(['list']);
```

### Custom Configuration Path

```bash
# Use custom config file
zodql plugin --config custom.json list
```

## Next Steps

- See `docs/PLUGIN_ECOSYSTEM.md` for plugin architecture
- See `src/plugins/README.md` for plugin development guide
- Check `src/plugins/examples/` for example plugins
