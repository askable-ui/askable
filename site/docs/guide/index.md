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
- **Inject** — `ctx.toPromptContext()` returns a string ready for any LLM system prompt.

## What it is not

askable-ui does **not**:
- Make LLM API calls itself — it only shapes the context you pass
- Replace your AI SDK or framework
- Track clicks for analytics — it only maintains the most-recent focused element (plus optional history)

## Next steps

- [Getting Started](/guide/getting-started) — install and wire up in 5 minutes
- [How It Works](/guide/how-it-works) — internals and architecture
- [API Reference](/api/core) — full method signatures and options
