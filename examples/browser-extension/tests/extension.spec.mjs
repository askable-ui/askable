import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test as base } from '@playwright/test';
import { isAskableBridgeEnvelope } from '@askable-ui/bridge';

const extensionPath = fileURLToPath(new URL('../dist/', import.meta.url));
const fixture = `<!doctype html>
<html lang="en"><head><title>Companion capture fixture</title>
<link rel="icon" href="data:,"></head><body>
<main><h1>Quarterly report</h1>
<p id="selection">Selected revenue increased by 12 percent.</p>
<button id="focus" aria-label="Revenue details">Focused revenue is $42 million.</button>
<button id="annotated" data-askable='{"metric":"retention","value":"91%"}'>Retention is 91 percent.</button>
<p>Full page only: operating margin is 24 percent.</p>
<a href="/details">Report details</a></main></body></html>`;

const test = base.extend({
  companion: async ({}, use) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(fixture);
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    let context;
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        headless: true,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
        ],
      });
      const errors = [];
      const externalRequests = [];
      const isExternal = (url) => /^(https?|wss?):/.test(url) && new URL(url).origin !== origin;
      context.on('weberror', (error) => errors.push(error.error().message));
      context.on('request', (request) => {
        if (isExternal(request.url())) externalRequests.push(request.url());
      });
      // Never allow a regression to send fixture captures to a remote endpoint.
      await context.route('**/*', (route) => isExternal(route.request().url())
        ? route.abort()
        : route.continue());
      await context.routeWebSocket(/.*/, (socket) => {
        externalRequests.push(socket.url());
        socket.close();
      });
      const worker = context.serviceWorkers()[0]
        ?? await context.waitForEvent('serviceworker');
      const extensionId = new URL(worker.url()).host;
      const page = await context.newPage();
      await page.goto(origin);
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(popup.locator('#status')).toHaveText('Ready');
      await popup.locator('#question').fill('Explain this local capture.');
      await page.bringToFront();
      await expect.poll(() => worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.url;
      })).toBe(`${origin}/`);

      await use({ page, popup, worker, origin });
      expect(errors, 'uncaught browser errors').toEqual([]);
      expect(externalRequests, 'no external requests from pages or worker').toEqual([]);
    } finally {
      await context?.close();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  },
});

async function lastEnvelope(popup) {
  return popup.evaluate(() => chrome.runtime.sendMessage({ type: 'askable-companion:get-last' }));
}

async function capture(popup, mode, label) {
  // Keep the HTTP tab active, just as it is when using the toolbar popup.
  // The real popup handler still queries tabs and uses chrome.tabs.sendMessage.
  await popup.locator(`[data-mode="${mode}"]`).evaluate((button) => button.click());
  await expect(popup.locator('#status')).toHaveText(`Captured ${label} context.`);
  const result = JSON.parse(await popup.locator('#packet').textContent());
  const prompt = await popup.locator('#prompt').inputValue();
  await expect(popup.locator('#copy')).toBeEnabled();
  expect(result.acks).toHaveLength(1);
  expect(result.acks[0].ok).toBe(true);
  expect(result.acks[0].response.ok).toBe(true);
  const stored = await lastEnvelope(popup);
  expect(stored.ok).toBe(true);
  expect(isAskableBridgeEnvelope(stored.envelope)).toBe(true);
  expect(stored.envelope.payload).toMatchObject({
    packet: result.packet,
    prompt,
    question: 'Explain this local capture.',
  });
  expect(stored.envelope.destination.kind).toBe('browser-extension');
  expect(stored.envelope.consent).toBe('explicit');
  return { packet: result.packet, prompt };
}

test('unpacked extension captures selected, focused, annotated, and full-page context locally', async ({ companion }) => {
  const { page, popup, origin } = companion;
  expect((await lastEnvelope(popup)).envelope).toBeNull();
  await page.locator('#selection').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const selected = await capture(popup, 'selected', 'selected text');
  expect(selected.packet.capture.mode).toBe('text-selection');
  expect(selected.packet.target.text).toBe('Selected revenue increased by 12 percent.');
  expect(JSON.stringify(selected.packet.surrounding.sources)).toContain('Selected revenue increased by 12 percent.');
  expect(selected.prompt).toContain('Selected revenue increased by 12 percent.');
  expect(selected.prompt).not.toContain('Full page only:');

  await page.evaluate(() => document.getSelection().removeAllRanges());
  await page.locator('#focus').focus();
  const focused = await capture(popup, 'focus', 'focused element');
  expect(focused.packet.capture.mode).toBe('element-focus');
  expect(focused.packet.target.selector).toBe('#focus');
  expect(JSON.stringify(focused.packet.surrounding.sources)).toContain('Focused revenue is $42 million.');
  expect(focused.prompt).toContain('Focused revenue is $42 million.');

  await page.locator('#annotated').click();
  const annotated = await capture(popup, 'focus', 'focused element');
  expect(annotated.packet.target.selector).toBe('#annotated');
  expect(annotated.prompt).toContain('retention');

  const fullPage = await capture(popup, 'page', 'full page');
  expect(fullPage.packet.capture.mode).toBe('full-page');
  expect(fullPage.packet.source.url).toBe(`${origin}/`);
  expect(JSON.stringify(fullPage.packet.surrounding.sources)).toContain('Full page only: operating margin is 24 percent.');
  expect(fullPage.prompt).toContain('Companion capture fixture');
  expect(fullPage.prompt).toContain('Quarterly report');
  expect(fullPage.prompt).toContain('Full page only: operating margin is 24 percent.');
  expect(fullPage.prompt).toContain(`${origin}/details`);
});

test('background rejects malformed envelopes and popup reports unavailable content scripts', async ({ companion }) => {
  const { page, popup } = companion;
  const response = await popup.evaluate(() => chrome.runtime.sendMessage({
    type: 'askable:bridge:context', envelope: {},
  }));
  expect(response).toMatchObject({ ok: false, error: 'Invalid Askable bridge envelope.' });
  expect((await lastEnvelope(popup)).envelope).toBeNull();

  await page.goto('about:blank');
  await popup.locator('[data-mode="page"]').evaluate((button) => button.click());
  await expect(popup.locator('#status')).not.toHaveText('Capturing full page context...');
  await expect(popup.locator('#status')).toContainText('Receiving end does not exist');
  await expect(popup.locator('#copy')).toBeDisabled();
  await expect(popup.locator('#prompt')).toHaveValue('');
  await expect(popup.locator('[data-mode="page"]')).toBeEnabled();
});
