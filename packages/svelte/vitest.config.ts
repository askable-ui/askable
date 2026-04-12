import { defineConfig } from 'vitest/config';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    conditions: ['browser'],
    alias: {
      '@askable-ui/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  plugins: [svelte({ hot: false, preprocess: vitePreprocess() })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
