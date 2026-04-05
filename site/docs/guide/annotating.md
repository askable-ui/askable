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

You can nest `[data-askable]` elements. When a user interacts with a nested element, the innermost (closest ancestor) element takes priority:

```html
<section data-askable='{"page":"dashboard"}'>
  <div data-askable='{"widget":"revenue-chart"}'>
    <!-- Clicking here focuses the inner widget, not the page -->
    <canvas></canvas>
  </div>
</section>
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
