# What is askable-ui?

**askable-ui** is a small, framework-agnostic library that bridges the gap between your UI and your AI assistant. It lets you annotate DOM elements with structured metadata and tracks what the user is currently focused on, so your LLM always has accurate context about the visible state of the page.

## The problem

When a user asks their AI assistant *"why is this dropping?"* while staring at a revenue chart, the LLM has no idea what *"this"* refers to. It sees only the text of the question — not the chart, not the data, not even which page the user is on.

The result is generic, unhelpful answers.

## The solution

Mark any element that carries meaning with a `data-askable` attribute:

```html
<div data-askable='{"metric":"revenue","delta":"-12%","period":"Q3"}'>
  <!-- your chart renders here -->
</div>
```

Then call one method before your LLM:

```ts
const prompt = ctx.toPromptContext();
// → "User is focused on: metric: revenue, delta: -12%, period: Q3"
```

The LLM now knows exactly what the user is looking at. The answer goes from *"revenue can decline for many reasons…"* to *"your Q3 revenue fell 12% — here's what likely caused it…"*

## Core ideas

- **Annotate** — Add `data-askable` to any element. The value can be a JSON object or a plain string.
- **Observe** — One `ctx.observe(document)` call covers the entire page. A `MutationObserver` automatically picks up dynamically rendered elements.
- **Capture** — Use clicks, hover, keyboard focus, Ask AI buttons, region selection, circle selection, lasso selection, highlighted text, or app events to decide what context the user means.
- **Inject** — `ctx.toPromptContext()` returns a string ready for any LLM system prompt. `ctx.toContextPacket()` returns a structured packet for MCP bridges, browser extensions, and agent runtimes.

## What it is not

askable-ui does **not**:
- Make LLM API calls itself — it only shapes the context you pass
- Replace your AI SDK or framework
- Track clicks for analytics — it only maintains the most-recent focused element (plus optional history)

## Interaction patterns

Start simple with annotated elements:

```html
<button data-askable='{"action":"refund","order":"A-1029"}'>
  Refund order
</button>
```

Then add explicit user-marking tools where the UI needs more precision:

```ts
const region = createAskableRegionCapture(ctx, { shape: 'lasso' });
region.start();

const text = createAskableTextSelectionCapture(ctx);
text.captureNow();
```

All of these feed the same `AskableContext`, so your chat surface can read one current context no matter whether the user clicked a card, pressed an Ask AI button, circled a chart anomaly, lassoed an area, or highlighted copy.

## Next steps

- [Getting Started](/guide/getting-started) — install and wire up in 5 minutes
- [How It Works](/guide/how-it-works) — internals and architecture
- [Context Packets](/guide/context) — structured packets for agents and MCP
- [API Reference](/api/core) — full method signatures and options
