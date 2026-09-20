const path = require('node:path')
const { build } = require('esbuild')
const { test, expect } = require('@playwright/test')

let fixture

test.beforeAll(async () => {
  const result = await build({
    absWorkingDir: path.resolve(__dirname, '..'),
    entryPoints: ['tests/dependency-fixture.tsx'],
    bundle: true,
    write: false,
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  })
  fixture = result.outputFiles[0].text
})

test('dashboard charts, icons, tabs and dropdown retain their semantics', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Analytics Dashboard' })).toBeVisible()
  const revenue = page.locator('[data-askable]').filter({ hasText: 'Revenue Trend' })
  await expect(revenue.locator('.recharts-area-curve')).toHaveAttribute('d', /^M/)
  await revenue.getByRole('application').focus()
  await expect(revenue.locator('.recharts-tooltip-wrapper')).toContainText('Jan')
  await page.keyboard.press('ArrowRight')
  await expect(revenue.locator('.recharts-tooltip-wrapper')).toContainText('Feb')
  await expect(revenue.locator('.recharts-tooltip-wrapper')).toContainText('3000')
  const traffic = page.locator('[data-askable]').filter({ hasText: 'Weekly Traffic' })
  await expect(traffic.locator('.recharts-bar-rectangle')).toHaveCount(14)
  await traffic.locator('.recharts-bar-rectangle').first().hover()
  await expect(traffic.locator('.recharts-tooltip-wrapper')).toContainText('1200')
  await expect(traffic.locator('.recharts-tooltip-wrapper')).toContainText('4500')
  const chartBounds = await revenue.locator('.recharts-surface').boundingBox()
  await expect.poll(async () => (await revenue.locator('.recharts-area-curve').boundingBox()).width)
    .toBeGreaterThan(chartBounds.width * 0.8)
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true })
  await expect(page.locator('svg.lucide-dollar-sign').first()).toHaveAttribute('aria-hidden', 'true')
  const menuTrigger = page.locator('header [data-slot="dropdown-menu-trigger"]')
  await menuTrigger.click()
  await expect(page.getByRole('menuitem', { name: 'Profile', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(menuTrigger).toBeFocused()
  await page.getByRole('button', { name: 'E-commerce', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'E-commerce Dashboard' })).toBeVisible()
  expect(errors).toEqual([])
})

test('custom chart content and Radix wrappers work at desktop and mobile widths', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [1200, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('about:blank')
    await page.setContent('<div id="fixture"></div>')
    await page.addScriptTag({ content: fixture })
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(4)
    await expect(page.locator('.recharts-legend-wrapper')).toContainText('Revenue')
    await expect(page.locator('.recharts-legend-wrapper')).toContainText('Orders')
    await page.getByRole('application').focus()
    await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('Jan')
    await page.keyboard.press('ArrowRight')
    const tooltip = page.locator('.recharts-tooltip-wrapper')
    await expect(tooltip).toContainText('Feb')
    await expect(tooltip).toContainText('revenue: 3000 (2 series)')
    await page.keyboard.press('ArrowLeft')
    await expect(tooltip).toContainText('Jan')
    await expect(tooltip).toContainText('revenue: 4000 (2 series)')
    await expect(tooltip).toContainText('orders: 240 (2 series)')
    await page.screenshot({ path: testInfo.outputPath(`chart-${width}.png`) })
    await page.getByText('Account', { exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Account' })).toBeFocused()
    await expect(page.getByRole('separator')).toHaveAttribute('data-orientation', 'horizontal')
    const toggle = page.getByRole('button', { name: 'Pin chart' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.press('Space')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const ratio = await page.getByTestId('ratio').boundingBox()
    expect(ratio.width / ratio.height).toBeCloseTo(16 / 9, 2)
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss notification' }).click()
    await expect(page.getByText('Saved', { exact: true })).toHaveCount(0)
  }
  expect(errors).toEqual([])
})
