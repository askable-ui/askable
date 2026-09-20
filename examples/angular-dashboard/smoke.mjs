import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = fileURLToPath(new URL('./dist/angular-dashboard/browser/', import.meta.url));
const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(`${resolve(root)}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(path);
    response.setHeader('Content-Type', contentTypes[extname(path)] ?? 'application/octet-stream');
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await expect(page.locator('.kpi-card')).toHaveCount(4);
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(page.locator('.kpi-card').first()).toHaveAttribute('data-askable-scope', 'kpis');
  await page.locator('.kpi-card').first().click();
  await expect(page.locator('.context-block').nth(0)).toContainText('Revenue');
  await expect(page.locator('.context-block').nth(1)).toContainText('Revenue');
  await expect(page.locator('.context-block').nth(2)).toContainText('Focused element:');
  await expect(page.locator('.context-block').nth(2)).toContainText('Revenue');
  await expect(page.locator('.context-block').nth(3)).toContainText('metric=Revenue');
  assert.deepEqual(errors, [], 'Dashboard must not log browser errors');
  console.log('Angular dashboard smoke passed: rendering, annotations, focus, history, composition.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
