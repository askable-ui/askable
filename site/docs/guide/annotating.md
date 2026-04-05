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

## What not to annotate

- Generic layout wrappers with no semantic meaning (`<div class="flex">`)
- Elements whose content is already entirely captured by a parent annotation
- Sensitive data (passwords, payment card numbers, PII) — `excludeKeys` is available if you need to strip fields at serialization time
