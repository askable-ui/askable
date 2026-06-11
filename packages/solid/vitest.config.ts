import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@askable-ui/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    transformMode: { web: [/\.[jt]sx?$/] },
  },
});
