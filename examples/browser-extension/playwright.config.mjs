import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'extension.spec.mjs',
  outputDir: './test-results',
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
});
