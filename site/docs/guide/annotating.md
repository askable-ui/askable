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

### Target strategy

The `targetStrategy` option passed to `observe()` controls how the winning element is chosen when nested `[data-askable]` elements are involved:

```ts
ctx.observe(document, { targetStrategy: 'deepest' });   // default
ctx.observe(document, { targetStrategy: 'shallowest' });
ctx.observe(document, { targetStrategy: 'exact' });
```

| Strategy | Behaviour |
|---|---|
| `'deepest'` | Innermost element wins. Use `data-askable-priority` to override. |
| `'shallowest'` | Outermost `[data-askable]` ancestor wins; inner elements are suppressed. |
| `'exact'` | Only fires when the event target itself has `[data-askable]`. No bubbled triggers. |

**`'shallowest'`** is useful for dashboards where a page-level context should always take precedence:

```html
<!-- With 'shallowest': clicking the chart fires the section, not the widget -->
<section data-askable='{"page":"analytics"}'>
  <div data-askable='{"widget":"revenue-chart"}'>
    <canvas></canvas>
  </div>
</section>
```

**`'exact'`** prevents any bubbling — the element that was directly clicked must carry the attribute:

```html
<!-- With 'exact': clicking the <canvas> inside the div does NOT fire the div -->
<div data-askable='{"widget":"revenue-chart"}'>
  <canvas></canvas>
</div>
```

### Priority targeting

Use `data-askable-priority` (numeric) to override the default innermost-wins rule within `'deepest'` strategy. Higher values win.

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

## Element-level text override

The `data-askable-text` attribute lets a single element override the text that Askable captures, independent of any `textExtractor` configured on the context.

```html
<!-- Use a cleaner label instead of the raw text content -->
<td data-askable='{"col":"revenue"}' data-askable-text="Revenue: $2.3M">
  <span class="currency">$</span>2.3<span class="unit">M</span>
</td>

<!-- Suppress text entirely for a sensitive field -->
<td data-askable='{"col":"ssn"}' data-askable-text="">
  ***-**-1234
</td>
```

`data-askable-text` takes priority over both `textContent` extraction and any custom `textExtractor`. Set it to an empty string `""` to send no text for that element — useful for sensitive data where the AI should rely only on the structured `meta` annotation.

This also works on framework `<Askable>` components by setting the HTML attribute directly:

```tsx
<Askable
  meta={{ col: 'ssn', type: 'sensitive' }}
  data-askable-text=""     // suppress text via HTML attribute
>
  ***-**-1234
</Askable>
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

## Accessibility-aware text extraction

By default, Askable uses `element.textContent.trim()` to derive the text for each focused element. For applications where accessible names (ARIA labels, `aria-labelledby`, `title`, `alt`) are more semantically meaningful to the LLM, use the built-in `a11yTextExtractor`:

```ts
import { createAskableContext, a11yTextExtractor } from '@askable-ui/core';

const ctx = createAskableContext({ textExtractor: a11yTextExtractor });
```

`a11yTextExtractor` follows this priority order, returning the first non-empty value:

| Priority | Source | Example |
|---|---|---|
| 1 | `aria-label` | `"Close dialog"` |
| 2 | `aria-labelledby` references | `"Q3 Revenue chart"` |
| 3 | `title` attribute | `"Bar chart — hover for details"` |
| 4 | `alt` attribute (images) | `"Revenue trend line"` |
| 5 | `placeholder` (inputs) | `"Search metrics…"` |
| 6 | `textContent.trim()` | `"Revenue: $2.3M"` |

This is useful for icon buttons, data cells with screen-reader-only labels, or any element whose visible text is less informative than its accessible name.

### Custom extractor

For full control, write your own extractor. The function receives the DOM element and returns a string. It applies to all focus events and explicit `select()` calls:

```ts
const ctx = createAskableContext({
  textExtractor: (el) => {
    // prefer data attribute, fall back to aria-label, then textContent
    return (
      el.getAttribute('data-label') ??
      el.getAttribute('aria-label') ??
      el.textContent?.trim() ??
      ''
    );
  },
});
```

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
