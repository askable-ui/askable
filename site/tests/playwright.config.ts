import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: '.',
  testMatch: 'website.spec.ts',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  outputDir: resolve(__dirname, '../../test-results/website'),
  reporter: [['list'], ['html', {
    outputFolder: resolve(__dirname, '../../playwright-report/website'),
    open: 'never',
  }]],
  use: {
    baseURL: process.env.WEBSITE_URL || 'http://127.0.0.1:4186',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.WEBSITE_URL ? undefined : {
    command: 'node site/tests/server.mjs',
    cwd: resolve(__dirname, '../..'),
    url: 'http://127.0.0.1:4186',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
