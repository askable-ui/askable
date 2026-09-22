import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto('/');
});

for (const width of [320, 390, 768, 1280, 1440]) {
  test(`layout fits ${width}px and keeps the first action visible`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 720 });
    await expect(page.locator('#kpi-grid .kpi-card')).toHaveCount(4);
    await expect(page.locator('#install-copy')).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Analytics workspace' })).toBeInViewport();
    await expect(page.locator('.developer-panel')).not.toHaveAttribute('open');
    await expect(page.locator('video')).not.toHaveAttribute('autoplay');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByText('Developer view', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'JSON', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`website-${width}.png`), fullPage: true });
  });
}

test('mobile menu supports keyboard, Escape, anchor navigation and outside clicks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.locator('#nav-menu');
  const summary = menu.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('open');
  await expect(menu.getByRole('link', { name: 'Docs', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open');
  await expect(summary).toBeFocused();
  await summary.click();
  await menu.getByRole('link', { name: 'MCP', exact: true }).click();
  await expect(page).toHaveURL(/#mcp$/);
  await expect(menu).not.toHaveAttribute('open');
  await summary.click();
  await page.getByRole('heading', { name: 'Connect the assistant you already use.' }).click();
  await expect(menu).not.toHaveAttribute('open');
  await summary.click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(menu).not.toHaveAttribute('open');
});

test('selected context can be reviewed, formatted, sent and removed', async ({ page }) => {
  await page.locator('.kpi-card').first().click();
  await page.getByText('Review context', { exact: true }).click();
  await expect(page.locator('#context-chip')).toContainText('$128,400');
  await expect(page.locator('#context-chip')).not.toContainText('Ask AI');
  await page.getByText('Developer view', { exact: true }).click();
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  await expect(page.getByRole('button', { name: 'JSON', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Natural', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#code-ctx')).toContainText('"widget": "revenue"');
  await page.getByRole('button', { name: 'Meta only', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Meta only', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Text + meta', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(JSON.parse(await page.locator('#code-ctx').innerText())).not.toHaveProperty('text');
  await page.getByLabel('Question about selected context').fill('Why is revenue growing?');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect(page.getByRole('log', { name: 'Demo conversation' })).toContainText('MRR grew 12.4%');
  await page.getByRole('button', { name: 'Remove selected context', exact: true }).click();
  await expect(page.locator('#chat-context-bar')).toBeHidden();
  await expect(page.locator('#chat-input')).toBeEmpty();
});

for (const shape of ['region', 'square', 'circle', 'lasso']) {
  test(`${shape} captures content and keeps the mode selected`, async ({ page }) => {
    const tool = page.locator(`[data-tool="${shape}"]`);
    await tool.click();
    await expect(tool).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.kpi-card').first().scrollIntoViewIfNeeded();
    const box = await page.locator('.kpi-card').first().boundingBox();
    if (!box) throw new Error('Missing KPI bounds');
    const x = box.x + 8, y = box.y + 8;
    await page.mouse.move(x, y);
    await page.mouse.down();
    if (shape === 'lasso') {
      await page.mouse.move(x + box.width - 16, y, { steps: 6 });
      await page.mouse.move(x + box.width - 16, y + box.height - 16, { steps: 6 });
      await page.mouse.move(x, y + box.height - 16, { steps: 6 });
      await page.mouse.move(x, y, { steps: 6 });
    } else {
      await page.mouse.move(x + box.width - 16, y + box.height - 16, { steps: 10 });
    }
    await page.mouse.up();
    await expect(page.locator('#selected-region-preview')).toContainText('Monthly Revenue');
    await expect(page.locator('#context-chip')).not.toContainText('Ask AI');
    await expect(tool).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('[data-mode="click"]')).toHaveAttribute('aria-pressed', 'true');
  });
}

test('text mode ignores plain clicks and retains captured text', async ({ page }) => {
  await page.locator('#send-selection').click();
  await page.locator('.kpi-card').first().click();
  await expect(page.locator('#chat-context-bar')).toBeHidden();
  await page.locator('.kpi-label').first().evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await expect(page.locator('#selected-text-preview')).toHaveText('Monthly Revenue');
  await page.getByLabel('Question about selected context').focus();
  await expect(page.locator('.text-capture-mark').first()).toBeVisible();
});

test('current capabilities and release boundaries are explicit', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Explore Bridge' })).toHaveAttribute('href', /guide\/bridge$/);
  await expect(page.locator('.release-note')).toContainText('not yet released to npm');
  await expect(page.locator('main')).not.toContainText('v0.15.0');
  const duplicateIds = await page.locator('[id]').evaluateAll(elements => {
    const ids = elements.map(element => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);
});
