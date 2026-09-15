import { test, expect } from '@playwright/test';
import { buildSync } from 'esbuild';
import path from 'node:path';

const bundle = buildSync({
  entryPoints: [path.resolve(__dirname, 'chat-fixture.tsx')],
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  alias: { '@askable-ui/core': path.resolve(__dirname, '../packages/core/src/index.ts') },
}).outputFiles[0].text;

test.beforeEach(async ({ page }) => {
  await page.route('https://askable.test/', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><title>Chat review test</title><div id="root"></div></html>',
  }));
  await page.goto('https://askable.test/');
  await page.addScriptTag({ content: bundle });
});

test('sends the reviewed selection even after live focus changes', async ({ page }) => {
  let received: Record<string, unknown> | undefined;
  await page.route('https://askable.test/api/chat', async (route) => {
    received = route.request().postDataJSON();
    await route.fulfill({ contentType: 'text/plain', body: 'Acme answer' });
  });

  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const approved = JSON.parse(await page.getByLabel('Reviewed payload').innerText());
  await page.getByRole('button', { name: 'Focus Globex' }).click();
  await page.getByRole('button', { name: 'Send approved' }).click();

  await expect(page.getByRole('region', { name: 'Conversation' })).toContainText('Acme answer');
  await expect(page.getByLabel('Chat status')).toHaveText('idle');
  expect(received).toEqual(approved);
  expect(received?.context).toContain('Acme');
  expect(received?.context).not.toContain('Globex');
});

test('Stop cancels the HTTP request and restores the send control', async ({ page }) => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  await page.route('https://askable.test/api/chat', async (route) => {
    await pending;
    await route.fulfill({ contentType: 'text/plain', body: 'Late response' });
  });

  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const requested = page.waitForRequest('https://askable.test/api/chat');
  await page.getByRole('button', { name: 'Send approved' }).click();
  await requested;
  const failed = page.waitForEvent('requestfailed', (request) => request.url().endsWith('/api/chat'));
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await failed;
  finish();

  await expect(page.getByLabel('Chat status')).toHaveText('idle');
  await expect(page.getByRole('button', { name: 'Send approved' })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Conversation' })).not.toContainText('Late response');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('HTTP failure leaves an error instead of a permanently pending chat', async ({ page }) => {
  await page.route('https://askable.test/api/chat', (route) => route.fulfill({ status: 503 }));
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Send approved' }).click();

  await expect(page.getByLabel('Chat status')).toHaveText('error');
  await expect(page.getByRole('alert')).toHaveText('HTTP 503');
  await expect(page.getByRole('button', { name: 'Send approved' })).toBeEnabled();
});
