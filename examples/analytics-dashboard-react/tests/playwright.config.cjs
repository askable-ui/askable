const path = require('node:path')

const port = Number(process.env.DASHBOARD_TEST_PORT || 3187)
const baseURL = `http://127.0.0.1:${port}`

// Uses Playwright and esbuild from the repository's root devDependencies.
module.exports = {
  testDir: __dirname,
  testMatch: '*.spec.cjs',
  outputDir: '../test-results',
  workers: 1,
  use: {
    baseURL,
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    cwd: path.resolve(__dirname, '..'),
    url: baseURL,
    reuseExistingServer: false,
  },
}
