# Angular dashboard

Standalone Angular 21 AOT example using the installed `@askable-ui/angular` package.
Use Node 20.19+ or Node 22.12+ within those major versions.

From the repository root (use local tarballs until a fixed release is published):

```bash
npm ci
npm run build -w @askable-ui/angular
askable_packages_dir=$(mktemp -d)
npm pack -w @askable-ui/angular -w @askable-ui/core -w @askable-ui/context --pack-destination "$askable_packages_dir" --quiet
cd examples/angular-dashboard
npm ci
npm install --no-save --package-lock=false "$askable_packages_dir"/askable-ui-angular-*.tgz "$askable_packages_dir"/askable-ui-core-*.tgz "$askable_packages_dir"/askable-ui-context-*.tgz
npm audit --audit-level=low
npm run build
npm start
```

The development server runs at `http://localhost:4200`. Build output is in
`dist/angular-dashboard/browser`.

## Compilation mode

The adapter is built with Angular's compiler in partial compilation mode so
consuming applications can use AOT. This example explicitly enables AOT and
does not import the runtime compiler. It uses Angular 21's default zoneless
change detection. The standalone dashboard exercises AskableDirective and
service injection; `aot/ngmodule-consumer.ts` also checks AskableModule and a
non-standalone component's template during compilation.

The npm 0.17.3 release predates this packaging fix. To test this checkout,
build and pack the local adapter, core and context workspaces, then install
their tarballs here before running the build. The dashboard CI workflow
performs these steps without replacing the standalone lockfile. Disabling
AOT or importing the runtime compiler would hide the regression being tested.

## Verification

The dedicated dashboard workflow tests Node 20 and 22. It clean-installs,
audits, installs tarballs of the current workspace adapter, core, and context
packages into the standalone example, and builds it with AOT. Chromium smoke
checks cover rendered KPI and deal counts, annotations, focus, navigation
history, and composed context. Packages are consumed from their packed output,
not through aliases to workspace TypeScript sources.

For the smoke check, first install the root workspace dependencies and
Chromium with `npx playwright install chromium` at the repository root.
After building the example, run from this directory:

```bash
node smoke.mjs
```

`smoke.mjs` serves the built files on an ephemeral loopback port and closes
the browser and server when finished. It uses the root Playwright dependency.
