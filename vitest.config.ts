import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^(.+)\/generators\/(.+)\.js$/,
        replacement: resolve(__dirname, 'src/generators/$2.ts'),
      },
      {
        find: /^(.+)\/zodql\/(.+)\.js$/,
        replacement: resolve(__dirname, 'src/zodql/$2.ts'),
      },
      {
        find: /^(.+)\/zodql\/index\.js$/,
        replacement: resolve(__dirname, 'src/zodql/index.ts'),
      },
      {
        find: /^(.+)\/test-reporter\.js$/,
        replacement: resolve(__dirname, 'src/test-reporter.ts'),
      },
    ],
  },
  esbuild: {
    target: 'node22',
  },
});

