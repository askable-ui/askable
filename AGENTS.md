# askable-ui — Agent Instructions

This file explains how to integrate `askable-ui` correctly. Copy it to your project root so coding agents have accurate, copy-pasteable guidance.

---

## What askable-ui does

`askable-ui` tracks which annotated UI element the user is currently focused on and serialises that focus into a prompt-ready string. You feed that string to your LLM — no manual prompt engineering required.

```
"User is focused on: metric: revenue — value $2.3M, delta +12%"
```

The three moving parts:
1. **Annotate** — add `data-askable` (or wrap with `<Askable>`) to any element whose data is relevant to AI
2. **Observe** — one hook/composable/store call wires the DOM listener
3. **Inject** — pass `promptContext` (or `ctx.toContext()`) into your LLM system prompt

---

## Installation

```bash
# React
npm install @askable-ui/react

# Vue 3
npm install @askable-ui/vue

# Svelte
npm install @askable-ui/svelte

# Vanilla / framework-agnostic
npm install @askable-ui/core
```

---

## Annotating elements

### HTML attribute (vanilla / any framework)

```html
<div data-askable='{"widget":"revenue","value":"$2.3M","delta":"+12%"}'>
  <RevenueChart />
</div>
```

- The value can be a **JSON object** (preferred) or a plain string.
- Only annotate elements whose data is meaningful to an AI answer. Do not annotate every div.

### React component

```tsx
import { Askable } from '@askable-ui/react';

<Askable meta={{ widget: 'revenue', value: '$2.3M', delta: '+12%' }}>
  <RevenueChart data={data} />
</Askable>
```

`<Askable>` keeps `data-askable` in sync with reactive props. Use it whenever `meta` comes from component state or props.

### Nesting and hierarchy

Nested `[data-askable]` elements are automatically chained. Inner elements inherit outer context.

```tsx
<Askable meta={{ section: 'deals' }}>
  <TableContainer>
    <Askable meta={{ row: 3, company: 'Acme', stage: 'Closed Won' }}>
      <TableRow />
    </Askable>
  </TableContainer>
</Askable>
```

When the row is focused the serialized output includes both levels.

### Override extracted text

By default askable-ui extracts `textContent`. Override it when the DOM text is noisy or screen-reader labels are better:

```html
<div data-askable='{"metric":"churn"}' data-askable-text="Monthly churn rate 4.2%">
  <ChurnChart />
</div>

<!-- Suppress text entirely -->
<div data-askable='{"id":42}' data-askable-text="">...</div>
```

### Priority

When two annotated elements overlap, the innermost wins by default. Set `data-askable-priority` to override:

```html
<div data-askable='{"section":"header"}' data-askable-priority="1">
  <div data-askable='{"cta":"upgrade"}' data-askable-priority="10">Upgrade</div>
</div>
```

---

## Passive interaction patterns

Passive patterns fire automatically as the user clicks, hovers, or focuses annotated elements.

### React

```tsx
import { Askable, useAskable } from '@askable-ui/react';

function Dashboard() {
  const { promptContext } = useAskable(); // shared context, all events

  return (
    <>
      <Askable meta={{ widget: 'revenue', value: kpi.revenue }}>
        <RevenueCard />
      </Askable>
      <Askable meta={{ widget: 'churn', value: kpi.churn }}>
        <ChurnChart />
      </Askable>
      <button onClick={() => sendToAI(promptContext)}>Ask AI</button>
    </>
  );
}
```

### Restrict which events trigger focus

```tsx
// Click-only — no hover, no keyboard focus
const { promptContext } = useAskable({ events: ['click'] });

// Hover + focus, no click
const { promptContext } = useAskable({ events: ['hover', 'focus'] });
```

### Vue 3

```vue
<script setup>
import { Askable, useAskable } from '@askable-ui/vue';
const { promptContext } = useAskable();
</script>

<template>
  <Askable :meta="{ widget: 'revenue', value: kpi.revenue }">
    <RevenueCard :data="kpi" />
  </Askable>
</template>
```

### Svelte

```svelte
<script>
  import { Askable, createAskableStore } from '@askable-ui/svelte';
  const { promptContext, ctx } = createAskableStore();
  // call ctx.destroy() in onDestroy
</script>

<Askable meta={{ widget: 'revenue', value: kpi.revenue }}>
  <RevenueCard data={kpi} />
</Askable>
```

### Vanilla JS

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document.body);

ctx.on('focus', () => {
  console.log(ctx.toPromptContext());
});
```

---

## Explicit "Ask AI" button pattern

Use `ctx.select(element)` when the user signals intent with a button rather than passive hover/click. This pins focus to a specific element regardless of cursor position.

### React

```tsx
import { useRef } from 'react';
import { Askable, useAskable } from '@askable-ui/react';

function RevenueCard({ data }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { ctx, promptContext } = useAskable();

  function askAboutThis() {
    if (cardRef.current) ctx.select(cardRef.current);
    sendToAI(promptContext);
  }

  return (
    <Askable meta={{ widget: 'revenue', value: data.value, delta: data.delta }}>
      <div ref={cardRef}>
        <RevenueChart data={data} />
        <button onClick={askAboutThis}>Ask AI about this</button>
      </div>
    </Askable>
  );
}
```

`ctx.select()` fires the same `focus` event and updates history exactly like a user interaction — downstream code needs no special case.

---

## Programmatic context (virtual DOM / third-party libraries)

For AG Grid, TanStack Virtual, Recharts, or any library that renders its own DOM, use `ctx.push()` instead of `data-askable`:

```ts
// In a row click handler (AG Grid, TanStack Table, etc.)
onRowClicked(event) {
  ctx.push(
    { widget: 'deals-table', rowIndex: event.rowIndex, company: event.data.company, stage: event.data.stage },
    `${event.data.company} — ${event.data.stage} — ${event.data.value}`
  );
}

// In a chart hover handler (Recharts, ECharts, etc.)
onChartHover(payload) {
  ctx.push(
    { chart: 'revenue-trend', month: payload.month, value: payload.revenue },
    `Revenue ${payload.month}: ${payload.revenue}`
  );
}
```

`push()` has no DOM element. `focus.element` is `undefined` but everything else (serialization, history, events) works identically.

---

## Injecting context into LLM calls

### Single-turn

```ts
const result = await streamText({
  model: openai('gpt-4o'),
  system: `You are a helpful analytics assistant.\n\n${promptContext}`,
  messages,
});
```

### Multi-turn with history

```ts
// Current focus + last 5 interactions in one string
const context = ctx.toContext({ history: 5 });

const result = await streamText({
  model: openai('gpt-4o'),
  system: `You are a helpful analytics assistant.\n\n${context}`,
  messages,
});
```

### Anthropic SDK

```ts
const response = await client.messages.create({
  model: 'claude-opus-4-7',
  system: `You are a helpful analytics assistant.\n\n${ctx.toContext({ history: 3 })}`,
  messages: [{ role: 'user', content: userMessage }],
  max_tokens: 1024,
});
```

### Multi-region pages

Use named contexts to keep independent regions isolated:

```tsx
const { ctx: tableCtx, promptContext: tableContext } = useAskable({ name: 'table' });
const { ctx: chartCtx, promptContext: chartContext } = useAskable({ name: 'chart' });

// Send only what's relevant at each AI boundary
await streamText({ system: `Table context:\n${tableContext}`, ... });
await streamText({ system: `Chart context:\n${chartContext}`, ... });
```

---

## Sanitization and noise control

Always sanitize before context leaves the client. Sanitization hooks run at **capture time** — data never reaches serialization raw.

### Strip sensitive fields

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext({
  sanitizeMeta: ({ password, ssn, cardNumber, ...safe }) => safe,
});
```

### Mask text patterns

```ts
const ctx = createAskableContext({
  sanitizeText: (text) =>
    text
      .replace(/\d{16}/g, '[card]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]'),
});
```

### Accessibility-friendly text extraction

```ts
import { createAskableContext, a11yTextExtractor } from '@askable-ui/core';

// Prefers aria-label > aria-labelledby > title > alt > placeholder > textContent
const ctx = createAskableContext({ textExtractor: a11yTextExtractor });
```

### React hook with private sanitized context

```tsx
const { promptContext } = useAskable({
  sanitizeMeta: ({ internalId, ...safe }) => safe,
  sanitizeText: (t) => t.slice(0, 200),
  maxHistory: 10,
});
```

When you pass any context-creation option to `useAskable`, it creates a **private** context rather than joining the shared singleton.

---

## Viewport context

Enable viewport tracking to serialise all currently visible annotated elements — useful for "what am I looking at?" queries.

```tsx
const { ctx } = useAskable({ viewport: true });

// In the AI call
const visibleContext = ctx.toViewportContext();
```

---

## Development inspector

Add the inspector overlay during development to see live focus metadata and prompt output:

```tsx
import { AskableInspector, useAskable } from '@askable-ui/react';

// Option A: standalone component (matches shared context automatically)
{process.env.NODE_ENV === 'development' && <AskableInspector />}

// Option B: inline with hook (same context, same events)
const { promptContext } = useAskable({ inspector: true, events: ['click'] });
```

Do not ship `<AskableInspector>` or `{ inspector: true }` in production builds.

---

## Common mistakes

**Over-annotating.** Only annotate elements whose data is directly useful to an AI answer. Annotating generic layout wrappers (`<header>`, `<nav>`, `<main>`) adds noise without value.

**Passing raw internal state.** `meta` becomes prompt text. Strip internal IDs, database primary keys, and implementation details before they reach `data-askable`. Use `sanitizeMeta` or curate `meta` at the component level.

**Noisy text extraction.** Large `textContent` blocks (tables, long lists) degrade prompt quality. Use `data-askable-text` to provide a concise label, `sanitizeText` to truncate, or `maxTextLength` in serialization options.

**Inspector context mismatch.** In React, `<AskableInspector />` without options creates its own default context. If your hook uses custom `events`, pass the same config to the inspector or use `useAskable({ inspector: true, events: [...] })` so they share one context.

```tsx
// Wrong — inspector runs on default context, hook runs on click-only context
useAskable({ events: ['click'] });
<AskableInspector />

// Correct — same context
useAskable({ inspector: true, events: ['click'] });
```

**Forgetting Svelte cleanup.** `createAskableStore` returns a `destroy` function. Call it in `onDestroy` or the observer leaks.

```svelte
<script>
  import { onDestroy } from 'svelte';
  import { createAskableStore } from '@askable-ui/svelte';
  const { promptContext, destroy } = createAskableStore();
  onDestroy(destroy);
</script>
```

**Calling `useAskable` multiple times with incompatible options.** In React/Vue, two calls with the same `events` config share one observer. Two calls with different options create separate private contexts. Be explicit with `name` when you need isolated regions.

**Serializing before a focus event fires.** `promptContext` is an empty string until the user interacts or `ctx.push()` / `ctx.select()` is called. Guard your LLM call or provide a fallback:

```ts
if (!promptContext) return; // or use a default system prompt
```

---

## Customising this file for your project

Before committing this file to your own repo, update the sections that are product-specific:

- Replace generic examples (`revenue`, `churn`) with your actual widget names and data shapes.
- Document which `events` your app uses and why.
- Document which fields are sanitized and the business reason.
- Add your app's LLM integration pattern (which SDK, which model, where context is injected).
- Remove framework sections that don't apply to your stack.

---

## Further reading

- [Getting started](https://askable-ui.com/docs/guide/getting-started)
- [Annotating elements](https://askable-ui.com/docs/guide/annotating)
- [React guide](https://askable-ui.com/docs/guide/react)
- [Vue guide](https://askable-ui.com/docs/guide/vue)
- [Svelte guide](https://askable-ui.com/docs/guide/svelte)
- [API reference](https://askable-ui.com/docs/api/core)
