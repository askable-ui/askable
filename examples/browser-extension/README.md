# Browser Extension Companion

This example shows the no-site-code path for Askable. A Manifest V3 extension
captures selected text, the last focused/clicked DOM element, or a full-page
snapshot from any normal web page, then sends it through an
`@askable-ui/bridge` envelope to the extension background worker.

It is intentionally provider-neutral. The popup shows the prompt context so you
can paste it into ChatGPT, Claude, Cursor, or your own chat UI. The background
worker validates the structured envelope and keeps the latest capture in memory.
Nothing is sent to a remote service. Copying the prompt is a separate user action;
any future forwarding integration needs its own consent and sanitization.

## Run it

From the repository root, using Node.js 22.12 or newer:

```bash
cd examples/browser-extension
npm ci
npm run build
```

The example installs the published Askable packages from its own lockfile,
without workspace aliases or a parent package build.

Then load the built extension:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select `examples/browser-extension/dist`.

Open any `http://` or `https://` page, select some text or click an element,
then open the extension popup and choose a capture mode.
After rebuilding, reload the extension on `chrome://extensions` and refresh the
page being captured so its content script is updated too. A Vite development
server is not needed.

## Tests

From `examples/browser-extension`:

```bash
npm test
npm run test:build
```

`npm test` rebuilds and runs the artifact checks; `npm run test:build` only checks
the existing `dist`. Every `npm run build` also runs these checks. They parse
each manifest-declared content script as a classic script and reject static
imports/exports, `import.meta`, top-level await, dynamic imports (including
comment-separated calls), `require`, and `importScripts`. Negative fixtures
verify that the check catches these regressions. The checks also verify that the
module worker and popup artifacts survive the second build.

For the real unpacked-extension smoke test, install the repository's existing
Playwright tooling and its matching Chromium once, from the repository root:

```bash
npm ci --ignore-scripts
npx playwright install chromium
cd examples/browser-extension
npm ci
npm test
npm run test:browser
```

The smoke test uses a temporary Chromium profile and a loopback-only HTTP fixture.
It loads the actual `dist` extension, exercises the popup's real tab messaging,
and validates selected text, focused DOM elements, annotated focus, page text,
and the background worker's acknowledged envelope. It also checks invalid
envelopes and unavailable content scripts, and blocks and fails on observed
external network requests. No Chrome API is mocked. The popup HTML runs in a
tab while the fixture stays active; native toolbar opening and clipboard access
still need manual checking.

Use Playwright's bundled Chromium, not installed Chrome or Edge: extension
sideloading uses a persistent context with the `chromium` channel, as described
in the [Playwright extension guide](https://playwright.dev/docs/chrome-extensions).
Browser installation or launch failures are test failures, not skipped checks.
The dedicated `test_browser_extension.yml` workflow runs both suites on Linux.

## What it captures

| Mode | Packet capture | Sources included |
|---|---|---|
| Selected text | `text-selection` | selected text, page title, URL |
| Focused element | `element-focus` | last clicked/focused DOM element plus page summary |
| Full page | `full-page` | title, URL, headings, links, and bounded page text |

On apps that already use `data-askable`, the same content script also observes
Askable focus. On arbitrary sites, it falls back to DOM and page sources from
`@askable-ui/core`.

## Architecture

```text
popup button
  -> content script capture command
  -> @askable-ui/core page/DOM sources
  -> @askable-ui/bridge browser-extension transport
  -> background worker validates AskableBridgeEnvelope
```

The content script uses:

- `createAskableContext()` to keep the current page state.
- `createAskablePageSource()` for unannotated page text, headings, selected
  text, and links.
- `createAskableDOMSource()` for the last clicked or focused element.
- `createBrowserExtensionTransport()` to send the same envelope any other
  Askable bridge receiver would get.

Vite runs twice: `vite.config.ts` first builds the module popup and background
worker and copies the manifest. `vite.content.config.ts` then builds only
`src/content.ts` as a standalone IIFE, bundling its dependencies into `content.js`
without clearing `dist`. Manifest content scripts are classic JavaScript, so
they cannot share ESM chunks with the module entries. Do not add the content
entry back to the multi-entry module build.

## Privacy notes

This example marks captures as explicit because the user presses the popup
button. It does not redact page text by default, so do not forward envelopes to
remote services until your extension applies a sanitizer or asks the user for
the right consent.

Capture results stay in the popup and the background worker's memory; the worker
can lose its latest envelope when Chrome suspends it. The example does not use
remote transports, analytics, or persistent capture storage. It observes page
interaction locally, and sends a capture envelope only when a popup button is pressed. Broad
HTTP(S) access is necessary for this automatically injected example; selection
mode also includes page metadata and may include existing Askable focus/history,
so it is not a sensitive-data isolation boundary.

Chrome extensions cannot inject content scripts into browser-owned pages such as
`chrome://extensions`, the Chrome Web Store, or restricted enterprise pages.
