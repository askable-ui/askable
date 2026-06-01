# How It Works

## The data flow

```
  UI interaction          AskableContext           Your AI handler
  ──────────────          ──────────────           ────────────────
  data-askable       ─►   current focus       ─►   ctx.toPromptContext()
  ctx.select()       ─►   history             ─►   ctx.toContextPacket()
  ctx.push()         ─►   visible elements    ─►   MCP / agent bridge
  region/text tools  ─►   Context packet
```

1. You annotate elements with `data-askable` or push semantic metadata from app code.
2. `ctx.observe()` starts a `MutationObserver` on the root you give it. As elements enter or leave the DOM, the observer attaches and detaches event listeners automatically.
3. When a user interacts with an annotated element, presses an Ask AI button, highlights text, draws a region, circles an area, or lassos an irregular shape, the context is updated or emitted as a Context packet.
4. Your AI handler calls `ctx.toPromptContext()` for prompt-ready text or `ctx.toContextPacket()` for structured agent/MCP transport.

## The Observer

`ctx.observe(root, options?)` is the single call that wires everything up.

- **Root** — typically `document`, but can be any `HTMLElement` for scoped subtrees.
- **Events** — by default listens for `click`, `mouseenter` (hover), and `focus`. Pass `{ events: ['click'] }` to restrict.
- **Hover debounce / throttle** — prevent rapid context churn when the cursor moves across many elements:
  ```ts
  ctx.observe(document, { hoverDebounce: 75 });   // wait 75 ms after pointer settles
  ctx.observe(document, { hoverThrottle: 100 });  // at most one update per 100 ms
  ```
- **Nested elements** — when a click reaches a parent `[data-askable]` element but the actual target is inside a closer nested `[data-askable]` descendant, the inner element takes priority.

## Parsing `data-askable`

The attribute value is parsed as JSON when possible; otherwise kept as a raw string.

```html
<!-- Parsed to Record<string, unknown> -->
<div data-askable='{"metric":"mrr","value":"$128k"}'></div>

<!-- Kept as string -->
<nav data-askable="main navigation"></nav>
```

This means `focus.meta` is either `Record<string, unknown>` or `string`. `toPromptContext()` handles both transparently.

## `toPromptContext()` output

The default output is a compact natural-language string:

```
User is focused on: — metric: mrr, value: $128k — value "Monthly Recurring Revenue"
```

- The prefix (`"User is focused on:"`) is configurable.
- Meta key-value pairs follow, formatted as `key: value, ...`.
- The element's trimmed `textContent` is appended as `value "..."` (label is configurable).
- See [Prompt Serialization](/guide/serialization) for all options including JSON output and token budgets.

## Explicit selection tools

Some user intent is not tied to one DOM element. Askable includes explicit capture tools for those cases:

| Tool | Best for | Packet mode |
| --- | --- | --- |
| `ctx.select(element)` | Ask AI buttons and known widgets | `element-focus` |
| `ctx.push(meta, text)` | App events, command palettes, generated summaries | `semantic` |
| `createAskableRegionCapture(ctx)` | Dragging a rectangular page area | `region` |
| `createAskableRegionCapture(ctx, { shape: 'square' })` | Selecting a fixed-ratio visual area | `region` |
| `createAskableRegionCapture(ctx, { shape: 'circle' })` | Circling one object or anomaly | `circle` |
| `createAskableRegionCapture(ctx, { shape: 'lasso' })` | Freehand irregular selections | `lasso` |
| `createAskableTextSelectionCapture(ctx)` | Browser-highlighted copy | `text-selection` |

Region, square, circle, lasso, and text capture mark `privacy.consent` as `explicit` because the user intentionally selected the context.

## Singleton vs. scoped contexts

Framework bindings (`useAskable`, `createAskableStore`) use a **shared singleton** by default. Multiple components calling the hook share the same observer — the context is created on first call and destroyed when the last consumer unmounts.

For advanced cases (multiple independent AI surfaces on one page), React's `useAskable` accepts an explicit `ctx` instance:

```ts
import { createAskableContext } from '@askable-ui/core';
import { useAskable } from '@askable-ui/react';

const myCtx = createAskableContext();
myCtx.observe(panelElement);

function MyPanel() {
  const { focus } = useAskable({ ctx: myCtx });
  // ...
}
```

## SSR behaviour

`ctx.observe()` is a no-op outside a browser environment — it checks for `window`, `document`, and `MutationObserver` before doing anything. Creating a context on the server is safe; observation simply does not start until the client takes over. See [SSR Safety](/guide/ssr) for details.
