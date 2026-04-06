import { test as base, type Page } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const BUNDLE_PATH = path.resolve(__dirname, '../e2e/.bundle/askable-core.js');

function ensureBundle() {
  const dir = path.dirname(BUNDLE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(BUNDLE_PATH)) {
    const entryPoint = path.resolve(__dirname, '../packages/core/src/index.ts');
    const esbuild = path.resolve(__dirname, '../node_modules/.bin/esbuild');
    execSync(
      `${esbuild} ${entryPoint} --bundle --format=iife --global-name=AskableCore --outfile=${BUNDLE_PATH}`,
      { cwd: path.resolve(__dirname, '..') }
    );
  }
}

export type TestFixtures = {
  /** Mount an in-memory HTML harness with AskableCore already loaded and `ctx` set up. */
  harness: (body: string, extraScript?: string) => Promise<Page>;
};

export const test = base.extend<TestFixtures>({
  harness: async ({ page }, use) => {
    ensureBundle();
    const bundleContent = fs.readFileSync(BUNDLE_PATH, 'utf-8');

    await use(async (body, extraSetup = '') => {
      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>e2e harness</title></head>
<body>
${body}
<script>
${bundleContent}
var createAskableContext = AskableCore.createAskableContext;
var a11yTextExtractor = AskableCore.a11yTextExtractor;
window.ctx = createAskableContext();
window.ctx.observe(document);
${extraSetup}
</script>
</body>
</html>`;
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      return page;
    });
  },
});

export { expect } from '@playwright/test';
