<p align="center">
  <img src="site/www/avatar.png" alt="askable-ui" width="96" />
</p>

<h1 align="center">askable-ui</h1>

<p align="center">
  <strong>UI context your LLM can actually use</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@askable-ui/core">
    <img src="https://img.shields.io/npm/v/@askable-ui/core?color=4f46e5&label=npm" alt="npm version" />
  </a>
  <a href="https://bundlephobia.com/package/@askable-ui/core">
    <img src="https://img.shields.io/badge/minzip-~1kb-4f46e5" alt="bundle size ~1kb" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/npm/l/@askable-ui/core?color=4f46e5" alt="license: MIT" />
  </a>
  <a href="https://github.com/askable-ui/askable/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/askable-ui/askable/ci.yml?branch=main&color=4f46e5&label=CI" alt="CI" />
  </a>
</p>

<p align="center">
  <a href="#why">Why</a> •
  <a href="#how-it-works">How it works</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#packages">Packages</a> •
  <a href="#documentation">Docs</a>
</p>

---

## Why

Most AI copilots ask your users to _describe_ what they're looking at. That's friction — and it's imprecise. The user already knows what they're looking at. The AI should too.

askable-ui solves this with a single HTML attribute. Mark any meaningful element with `data-askable` and attach structured metadata. Askable tracks which element the user last interacted with and serializes it into a prompt-ready string at the AI boundary. The model gets the user's exact visual focus — not a guess, the real thing.

No page scraping. No giant DOM serialization. No prompt bloat.

---

## How it works

**1. Annotate your UI elements**

```tsx
import { Askable } from '@askable-ui/react';

// The same data that renders your chart also feeds the AI.
// No duplication, no sync issues.
<Askable meta={{ metric: 'revenue', value: '$2.3M', delta: '+12%', period: 'Q3' }}>
  <RevenueChart data={data} />
</Askable>
```

**2. Observe once**

```tsx
import { useAskable } from '@askable-ui/react';

const { ctx, promptContext } = useAskable();
// ctx.observe(rootEl) is called automatically.
// promptContext updates whenever the user interacts.
```

**3. Inject at the AI boundary**

```ts
// Works with any LLM SDK — Vercel AI, Anthropic, OpenAI, CopilotKit, etc.
const result = await streamText({
  model: openai('gpt-4o'),
  system: `You are a helpful analytics assistant.\n\n${promptContext}`,
  messages,
});

// promptContext looks like:
// "User is focused on: — metric: revenue, value: $2.3M, delta: +12%, period: Q3"
```

`promptContext` updates automatically. No polling, no manual wiring, no extra API calls.

---

## Features

### Zero configuration

Drop in one attribute. Works with any existing DOM structure, any styling system, any component library. The observer attaches lazily and tears down cleanly.

### Framework adapters

React, Vue 3, and Svelte adapters ship with idiomatic hooks and components. The underlying `@askable-ui/core` is framework-agnostic — integrate directly in vanilla JS, Astro, Qwik, or any custom setup.

### SSR safe

Observation defers to the client lifecycle (`useEffect` / `onMounted`). Import freely in any server-rendered context — Next.js, Nuxt, SvelteKit. No `window is not defined` errors.

### Explicit "Ask AI" button pattern

```ts
// Programmatically pin focus to a specific element
ctx.select(cardRef.current);
openChatPanel();
```

Use `ctx.select()` for "Ask AI" buttons. The copilot always answers about the element the user explicitly chose.

### Context-in-input UX

When an element is selected, pre-fill the chat input with a suggested question rather than auto-sending to the model. The user sees what context will be included, edits their question, and sends on their own terms.

### Conversation history

```ts
ctx.toHistoryContext(5); // last 5 focus events, newest first
```

Send focus history alongside the current element for multi-turn conversations that understand where the user has been.

### Redaction hooks

```ts
const ctx = createAskableContext({
  sanitizeMeta: ({ _id, internalRef, ...safe }) => safe,
  sanitizeText: (text) => text.replace(/\d{3}-\d{2}-\d{4}/g, '[ssn]'),
});
```

Redact sensitive fields at capture time — before data reaches `getFocus()`, history, or serialization.

### Inspector dev panel

```ts
import { createAskableInspector } from '@askable-ui/core';
if (process.env.NODE_ENV === 'development') createAskableInspector();
```

A floating overlay shows which element is currently focused, what context it would emit, and the last five interactions. Zero production overhead.

---

## Quick start

<details>
<summary>React</summary>

```bash
npm install @askable-ui/react
```

```tsx
// Wrap meaningful elements with <Askable>
import { Askable, useAskable } from '@askable-ui/react';

function Dashboard({ kpi }) {
  const { promptContext } = useAskable();

  async function handleAsk(userMessage: string) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ context: promptContext, message: userMessage }),
    });
    // ...
  }

  return (
    <Askable meta={{ metric: kpi.name, value: kpi.value, trend: kpi.trend }}>
      <KPICard data={kpi} />
    </Askable>
  );
}
```

</details>

<details>
<summary>Vue 3</summary>

```bash
npm install @askable-ui/vue
```

```vue
<script setup>
import { Askable, useAskable } from '@askable-ui/vue';

const { promptContext } = useAskable();
const props = defineProps(['kpi']);
</script>

<template>
  <Askable :meta="{ metric: kpi.name, value: kpi.value, trend: kpi.trend }">
    <KPICard :data="kpi" />
  </Askable>
</template>
```

</details>

<details>
<summary>Svelte</summary>

```bash
npm install @askable-ui/svelte
```

```svelte
<script>
  import { Askable, useAskable } from '@askable-ui/svelte';
  const { promptContext } = useAskable();
  export let kpi;
</script>

<Askable meta={{ metric: kpi.name, value: kpi.value, trend: kpi.trend }}>
  <KPICard data={kpi} />
</Askable>
```

</details>

<details>
<summary>Vanilla JS / any framework</summary>

```bash
npm install @askable-ui/core
```

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document.body);

ctx.on('focus', (focus) => {
  console.log(ctx.toPromptContext());
  // "User is focused on: — metric: revenue, value: $2.3M"
});
```

</details>

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                      Your UI                        │
│                                                     │
│  <div data-askable='{"metric":"revenue","v":"$2M"}'>│
│    <RevenueChart />                                 │
│  </div>                                             │
└───────────────────────┬─────────────────────────────┘
                        │ click / hover / focus
                        ▼
             ┌──────────────────────┐
             │     Observer         │  one querySelectorAll() at init
             │                      │  one MutationObserver (dynamic DOM)
             │  • tracks [data-     │  event listeners on annotated
             │    askable] elements │  elements only (~1 kb gz)
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │   AskableContext     │  getFocus()     → current element
             │   (focus state)      │  getHistory(n)  → last n events
             │                      │  on('focus')    → reactive handler
             └──────────┬───────────┘
                        │  you call at the AI boundary
                        ▼
             ┌──────────────────────┐
             │  toPromptContext()   │  natural language or JSON
             │  toHistoryContext()  │  multi-turn conversation context
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │    Your LLM call     │  OpenAI · Anthropic · Vercel AI
             │                      │  CopilotKit · LangChain · any SDK
             └──────────────────────┘
```

| Component | Responsibility |
|---|---|
| `Observer` | Attaches listeners to `[data-askable]` elements; tracks DOM changes via MutationObserver |
| `AskableContext` | Holds current focus + history; emits events; applies sanitizers |
| `toPromptContext()` | Pure serialization — no DOM access, sub-millisecond |
| Framework adapters | Thin reactive wrappers around core; SSR-safe lifecycle management |

---

## Packages

| Package | Version | Use when |
|---|---|---|
| [`@askable-ui/core`](https://www.npmjs.com/package/@askable-ui/core) | [![npm](https://img.shields.io/npm/v/@askable-ui/core?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/core) | Vanilla JS, custom framework, or as a peer dep |
| [`@askable-ui/react`](https://www.npmjs.com/package/@askable-ui/react) | [![npm](https://img.shields.io/npm/v/@askable-ui/react?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/react) | React 18+ |
| [`@askable-ui/vue`](https://www.npmjs.com/package/@askable-ui/vue) | [![npm](https://img.shields.io/npm/v/@askable-ui/vue?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/vue) | Vue 3 |
| [`@askable-ui/svelte`](https://www.npmjs.com/package/@askable-ui/svelte) | [![npm](https://img.shields.io/npm/v/@askable-ui/svelte?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/svelte) | Svelte / SvelteKit |
| [`askable-shared`](https://pypi.org/project/askable-shared/) | [![PyPI](https://img.shields.io/pypi/v/askable-shared?color=4f46e5)](https://pypi.org/project/askable-shared/) | Python — serialize context from Django, FastAPI, Streamlit |

---

## Documentation

**[askable-ui.github.io/askable/docs →](https://askable-ui.github.io/askable/docs/)**

| Guide | |
|---|---|
| [Getting started](https://askable-ui.github.io/askable/docs/guide/getting-started) | Install, observe, inject |
| [Annotating elements](https://askable-ui.github.io/askable/docs/guide/annotating) | `data-askable`, nesting, priority, text override |
| [React](https://askable-ui.github.io/askable/docs/guide/react) · [Vue](https://askable-ui.github.io/askable/docs/guide/vue) · [Svelte](https://askable-ui.github.io/askable/docs/guide/svelte) | Framework-specific hooks and components |
| [CopilotKit integration](https://askable-ui.github.io/askable/docs/guide/copilotkit) | Context-in-input pattern, suggestions |
| [Inspector dev panel](https://askable-ui.github.io/askable/docs/guide/inspector) | Development overlay |
| [Python](https://askable-ui.github.io/askable/docs/guide/python) | Django, FastAPI, Streamlit |
| [API reference](https://askable-ui.github.io/askable/docs/api/core) | Full type docs |

---

## Development

```bash
# Clone and install
git clone https://github.com/askable-ui/askable.git
cd askable
npm install

# Build all packages
npm run build

# Run unit tests
npm test

# Run cross-browser Playwright tests (Chromium / Firefox / WebKit)
npm run test:e2e

# Run the performance benchmark
node packages/core/bench/perf.mjs

# Type-check
tsc --noEmit -p packages/core/tsconfig.json
```

Branch naming: `feat/...` · `fix/...` · `chore/...` — open a PR against `main`.

---

## License

MIT — see [LICENSE](./LICENSE)
