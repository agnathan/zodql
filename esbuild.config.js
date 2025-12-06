import { build } from 'esbuild';
import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

const baseConfig = {
  entryPoints: [
    'src/index.ts',
    'src/cli/zodql-cli.ts',
    'src/cli/plugin-cli.ts',
    'src/cli/graphql-to-zodql.ts',
  ],
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external: ['zod'],
  logLevel: 'info',
};

const productionConfig = {
  ...baseConfig,
  minify: true,
  sourcemap: true,
};

const developmentConfig = {
  ...baseConfig,
  minify: false,
  sourcemap: true,
};

async function buildProduction() {
  console.log('Building for production...');
  await build(productionConfig);
  console.log('Production build complete!');
}

async function buildDevelopment() {
  console.log('Building for development...');
  await build(developmentConfig);
  console.log('Development build complete!');
}

async function buildWatch() {
  console.log('Building in watch mode...');
  const ctx = await build({
    ...developmentConfig,
    watch: {
      onRebuild(error, result) {
        if (error) {
          console.error('Watch build failed:', error);
        } else {
          console.log('Watch build succeeded');
        }
      },
    },
  });
  console.log('Watching for changes...');
}

// Parse command line arguments
const command = process.argv[2];

if (command === 'dev') {
  buildDevelopment().catch(() => process.exit(1));
} else if (command === 'watch') {
  buildWatch().catch(() => process.exit(1));
} else {
  // Default to production
  buildProduction().catch(() => process.exit(1));
}

