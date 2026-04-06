# Browser Support

## Supported browsers

askable-ui targets **modern evergreen browsers**:

| Browser | Minimum version |
|---|---|
| Chrome / Chromium | 80+ |
| Firefox | 78+ |
| Safari / WebKit | 14+ |
| Edge (Chromium) | 80+ |

Mobile browsers (Chrome for Android, Safari iOS) follow the same policy. IE11 and legacy Edge (EdgeHTML) are **not supported**.

## Browser API dependencies

askable-ui relies on the following browser APIs:

| API | Used for | Fallback |
|---|---|---|
| `MutationObserver` | Detecting dynamically added/removed `[data-askable]` elements | No-op — `observe()` does nothing if unavailable |
| `addEventListener` | Click, hover, and focus event listeners | No-op |
| `Element.closest()` | Nested element resolution | Not polyfilled |
| `Element.contains()` | Containment checks for nested strategy | Not polyfilled |

If `window`, `document`, or `MutationObserver` are not present (SSR, Node.js, old browsers), `observe()` exits immediately without attaching any listeners. Context creation, serialization, and `select()` are always safe.

## Node.js / SSR

All packages are safe to import and render in Node.js. See [SSR Safety](/guide/ssr) for the full server/client boundary documentation.

## Polyfills

askable-ui does not ship or require polyfills. If you need to support older browsers:

- `MutationObserver` — widely supported since 2013; no polyfill needed for any realistic target
- `Element.closest()` — available everywhere; if you target very old Safari, add the standard [MDN polyfill](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest#polyfill)

## Testing targets

CI runs tests in Node.js + jsdom (unit). Browser-level integration tests (Playwright) are tracked in [#16](https://github.com/askable-ui/askable/issues/16).
