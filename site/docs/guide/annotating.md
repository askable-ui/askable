# Annotating Elements

## The `data-askable` attribute

Any DOM element can be annotated. The value is either a **JSON object** (parsed automatically) or a **plain string**.

```html
<!-- JSON object — gives the LLM structured, queryable data -->
<div data-askable='{"metric":"revenue","delta":"-12%","period":"Q3"}'>...</div>

<!-- Plain string — useful for simple semantic labels -->
<nav data-askable="main navigation">...</nav>
```

::: tip Use JSON objects for data-driven elements
Plain strings work, but JSON objects let you `excludeKeys`, reorder with `keyOrder`, and give the LLM more structured context to reason about. Use strings for static labels like page sections, navigation items, or UI region names.
:::

## Framework components

Each framework binding ships an `<Askable>` component that manages the attribute reactively:

::: code-group

```tsx [React]
// The meta prop can be a live variable — the attribute updates on every render
<Askable meta={liveData}>
  <Chart data={liveData} />
</Askable>
```

```vue [Vue]
<!-- Reactive — updates when data changes -->
<Askable :meta="liveData">
  <Chart :data="liveData" />
</Askable>
```

```svelte [Svelte]
<!-- Reactive — updates when data changes -->
<Askable meta={liveData}>
  <Chart data={liveData} />
</Askable>
```

:::

The key insight: **the same data that renders your component also feeds the AI**. No duplication, no sync issues.

## Nesting

You can nest `[data-askable]` elements. When a user interacts with a nested element, the innermost (closest ancestor) element takes priority by default:

```html
<section data-askable='{"page":"dashboard"}'>
  <div data-askable='{"widget":"revenue-chart"}'>
    <!-- Clicking here focuses the inner widget, not the page -->
    <canvas></canvas>
  </div>
</section>
```

### Priority targeting

Use `data-askable-priority` (numeric) to override the default innermost-wins rule. Higher values win.

```html
<!-- Outer has higher priority — clicking the inner card still focuses the section -->
<section data-askable='{"section":"highlights"}' data-askable-priority="10">
  <div data-askable='{"card":"revenue"}'>
    <canvas></canvas>
  </div>
</section>
```

When priorities are equal, the default innermost-wins rule applies. You only need to set the attribute on elements where you want to override that default.

A common use case is a "selected row" pattern where the table-level annotation should take over from individual cell annotations when the row is in a special state:

```html
<tr data-askable='{"row":"order-42","status":"selected"}' data-askable-priority="5">
  <td data-askable='{"col":"amount"}'>$1,200</td>
  <td data-askable='{"col":"date"}'>2024-03-01</td>
</tr>
```

## Dynamic elements

The underlying `MutationObserver` automatically attaches listeners when new `[data-askable]` elements appear in the DOM and detaches them when they are removed. You do not need to call `observe()` again after async renders, route changes within an SPA, or virtualized list updates.

## What to annotate

Good candidates:

| Element type | Example meta |
|---|---|
| Data visualisation | `{"chart":"revenue","period":"Q3","delta":"-12%"}` |
| Table row / record | `{"type":"customer","id":"cus_123","plan":"pro"}` |
| Form / form field | `{"form":"checkout","field":"billing-address","step":2}` |
| Navigation item | `{"page":"pricing","plan":"enterprise"}` |
| Modal / panel | `{"dialog":"delete-confirm","target":"account"}` |
| Dashboard KPI | `{"metric":"churn","value":"4.2%","trend":"up"}` |
| Page section | `"analytics overview"` |

## Custom text extraction

By default, Askable uses `element.textContent.trim()` to derive the text for each focused element. You can override this globally when creating the context:

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext({
  textExtractor: (el) =>
    el.getAttribute('aria-label') ??
    el.getAttribute('title') ??
    el.textContent?.trim() ??
    '',
});
```

The extractor receives the DOM element and returns a string. It applies to all focus events — clicks, hovers, and explicit `select()` calls.

Use this when:
- Accessible names (ARIA labels) are more meaningful to the LLM than raw text content
- Elements contain noisy child text (icons, timestamps, decorative strings) you want to exclude
- You need a different representation per element type

## Sanitization and redaction

For production apps with sensitive data, configure context-level sanitizers when creating the context. These run at **capture time** — before the focus is stored or emitted — so sanitized values flow through all outputs: `getFocus()`, history, events, and `toPromptContext()`.

### Redact metadata fields

```ts
const ctx = createAskableContext({
  sanitizeMeta: ({ password, ssn, cardNumber, ...safe }) => safe,
});
```

`sanitizeMeta` only applies when meta is a JSON object. Plain string meta is passed through unchanged.

### Mask text content

```ts
const ctx = createAskableContext({
  sanitizeText: (text) =>
    text
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[card]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]'),
});
```

### Combine both

```ts
const ctx = createAskableContext({
  sanitizeMeta: ({ _internalId, ...safe }) => safe,
  sanitizeText: (text) => text.replace(/\d{3}-\d{2}-\d{4}/g, '[ssn]'),
});
```

For per-call field exclusion at serialization time, use `excludeKeys` in `toPromptContext({ excludeKeys: ['debug'] })` instead.

## What not to annotate

- Generic layout wrappers with no semantic meaning (`<div class="flex">`)
- Elements whose content is already entirely captured by a parent annotation
- Sensitive data (passwords, payment card numbers, PII) — use `sanitizeMeta`/`sanitizeText` at context creation or `excludeKeys` at serialization time
