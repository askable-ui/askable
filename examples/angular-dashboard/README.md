# Angular dashboard

Standalone Angular 21 example using the published `@askable-ui/angular` package.
Use Node 20.19+ or Node 22.12+ within those major versions.

From this directory:

```bash
npm ci
npm audit --audit-level=low
npm run build
npm start
```

The development server runs at `http://localhost:4200`. Build output is in
`dist/angular-dashboard/browser`.

## Compilation mode

The adapter's existing published format is plain TypeScript output with
decorators, without the Angular metadata required by AOT consumers. This
example therefore explicitly sets `aot: false` and loads `@angular/compiler`.
It uses Angular 21's default zoneless change detection. JIT includes the
runtime compiler and has a larger bundle; this is not an AOT packaging fix
or a claim of compatibility with CSP policies that prohibit runtime code
generation. Do not weaken a production CSP to accommodate this example.

## Verification

The dedicated dashboard workflow tests Node 20 and 22. It clean-installs,
audits, and builds the standalone published-package example, then rebuilds
with tarballs of the current workspace adapter, core, and context packages.
Chromium smoke checks cover both builds, including rendered KPI and deal
counts, annotations, focus, navigation history, and composed context.

For the smoke check, first install the root workspace dependencies and
Chromium with `npx playwright install chromium` at the repository root.
After building the example, run from this directory:

```bash
node smoke.mjs
```

`smoke.mjs` serves the built files on an ephemeral loopback port and closes
the browser and server when finished. It uses the root Playwright dependency.
