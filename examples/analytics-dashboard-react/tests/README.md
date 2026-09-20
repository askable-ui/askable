# Dependency Regression Tests

Install the repository root development dependencies (`npm ci` at the root) and
the dashboard dependencies (`npm ci` in this example). The suite reuses the root
Playwright and esbuild packages without adding another test toolchain.

From this example directory, run:

```sh
npm run build
npm run test:dependencies
```

Install the Playwright Chromium browser first, or set `PLAYWRIGHT_CHANNEL=chrome`
to use an installed Google Chrome. Set `DASHBOARD_TEST_PORT` if port 3187 is busy.
The suite starts and stops its own production server. Screenshots are written to
the ignored `test-results` directory.

Coverage includes rendered chart data, keyboard and pointer tooltips, custom
tooltip formatter payloads, custom legends, icons, dropdown focus restoration,
and Radix label, separator, aspect-ratio, toast, and toggle behavior. The isolated
component fixture is also exercised at a 390px viewport.
