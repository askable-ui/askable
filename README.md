<p align="center">
  <img src="site/www/avatar.png" alt="askable-ui" width="96" />
</p>

<h1 align="center">askable-ui</h1>

<p align="center">
  <strong>Two lines of code to give your LLM eyes.</strong><br />
  One attribute. Zero prompt engineering. It knows exactly what the user sees.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@askable-ui/core">
    <img src="https://img.shields.io/npm/v/@askable-ui/core?color=4f46e5&label=npm" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@askable-ui/core">
    <img src="https://img.shields.io/npm/dw/@askable-ui/core?color=4f46e5&label=downloads" alt="npm downloads" />
  </a>

  <a href="./LICENSE">
    <img src="https://img.shields.io/npm/l/@askable-ui/core?color=4f46e5" alt="MIT license" />
  </a>
  <a href="https://github.com/askable-ui/askable/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/askable-ui/askable/static_quality.yml?branch=main&color=4f46e5&label=CI" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/PRs-welcome-4f46e5" alt="PRs welcome" />
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &nbsp;·&nbsp;
  <a href="#why">Why</a> &nbsp;·&nbsp;
  <a href="#how-it-works">How it works</a> &nbsp;·&nbsp;
  <a href="#works-with">Works with</a> &nbsp;·&nbsp;
  <a href="#features">Features</a> &nbsp;·&nbsp;
  <a href="#packages">Packages</a> &nbsp;·&nbsp;
  <a href="https://askable-ui.com/docs/">Docs</a> &nbsp;·&nbsp;
  <a href="https://askable-ui.com/docs/guide/agents">Agent Templates</a> &nbsp;·&nbsp;
  <a href="https://askable-mu.vercel.app/">Live Demo</a>
</p>

<p align="center">
  <video src="https://github.com/user-attachments/assets/1d849070-d486-471d-9fcb-ffafe90c485a" autoplay loop muted playsinline width="720"></video>
</p>

---

## Quick start

```bash
npm install @askable-ui/react
```

Want a runnable Askable + CopilotKit starter app instead?

```bash
npx create-askable-app my-app
cd my-app
npm install
npm run dev
```

```tsx
import { Askable, useAskable } from '@askable-ui/react';

function Dashboard({ kpi }) {
  const { promptContext } = useAskable();
  // promptContext: "User is focused on: metric=revenue, value=$2.3M, delta=+12%"

  return (
    <Askable meta={{ metric: kpi.name, value: kpi.value, delta: kpi.delta }}>
      <KPICard data={kpi} />
    </Askable>
  );
}
```

That's it. `promptContext` updates automatically as the user interacts. Pass it to any LLM.

---

## Why

AI copilots ask users to _describe_ what they're looking at.
That's friction — and it's imprecise.

askable-ui solves this with one HTML attribute. Mark any element with `data-askable`, and the library tracks user focus and serializes it into a prompt-ready string. The model gets the user's exact visual context — not a guess, the real thing.

No page scraping. No DOM serialization. No prompt bloat. **Lightweight and zero-dependency.**

---

## How it works

**1. Annotate** — same data that renders your chart feeds the AI

```tsx
<Askable meta={{ metric: 'revenue', value: '$2.3M', delta: '+12%', period: 'Q3' }}>
  <RevenueChart data={data} />
</Askable>
```

**2. Observe** — automatic, zero config

```tsx
const { ctx, promptContext } = useAskable();
// promptContext updates whenever the user clicks, hovers, or focuses

const { ctx: tableCtx } = useAskable({ name: 'table' });
const { ctx: chartCtx } = useAskable({ name: 'chart' });
// named contexts stay isolated for multi-region pages

const { ctx: screenCtx } = useAskable({ viewport: true });
// screenCtx.toViewportContext() serializes currently visible annotated elements
```

**3. Inject** — at the AI boundary, one line

```ts
const result = await streamText({
  model: openai('gpt-4o'),
  system: `You are a helpful analytics assistant.\n\n${promptContext}`,
  messages,
});
```

---

## Works with

**LLM SDKs** — OpenAI · Anthropic · Vercel AI SDK · CopilotKit · LangChain · any SDK

**Frameworks** — React · Vue 3 · Svelte · Vanilla JS · Next.js · Nuxt · SvelteKit

askable-ui is the context layer. It doesn't replace your LLM SDK — it gives it eyes.

---

## Features

- **Zero config** — one attribute, works with any DOM structure, styling system, or component library
- **React, Vue, Svelte** — idiomatic hooks and components; core is framework-agnostic
- **SSR safe** — defers to client lifecycle, no `window is not defined`
- **"Ask AI" button** — `ctx.select(element)` pins focus to any element programmatically
- **Conversation history** — `ctx.toHistoryContext(n)` for multi-turn context
- **Viewport awareness** — `ctx.getVisibleElements()` / `ctx.toViewportContext()` for on-screen context
- **Redaction hooks** — strip sensitive fields before data reaches serialization
- **Inspector panel** — `<AskableInspector />` or `useAskable({ inspector: true })` for a live dev overlay
- **Agent templates** — reusable `AGENTS.md` guidance and copy-paste prompts for coding-agent-driven adoption
- **Lightweight core** — zero runtime dependencies

---

## Packages

| Package | Version | Use when |
|---|---|---|
| [`@askable-ui/core`](https://www.npmjs.com/package/@askable-ui/core) | [![npm](https://img.shields.io/npm/v/@askable-ui/core?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/core) | Vanilla JS, custom framework, or as a peer dep |
| [`@askable-ui/react`](https://www.npmjs.com/package/@askable-ui/react) | [![npm](https://img.shields.io/npm/v/@askable-ui/react?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/react) | React 18+ |
| [`@askable-ui/react-native`](https://www.npmjs.com/package/@askable-ui/react-native) | [![npm](https://img.shields.io/npm/v/@askable-ui/react-native?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/react-native) | React Native (initial press-driven adapter) |
| [`@askable-ui/vue`](https://www.npmjs.com/package/@askable-ui/vue) | [![npm](https://img.shields.io/npm/v/@askable-ui/vue?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/vue) | Vue 3 |
| [`@askable-ui/svelte`](https://www.npmjs.com/package/@askable-ui/svelte) | [![npm](https://img.shields.io/npm/v/@askable-ui/svelte?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/svelte) | Svelte 4 & 5 |
| [`create-askable-app`](https://www.npmjs.com/package/create-askable-app) | npm package | React + Vite + CopilotKit starter scaffold |

<details>
<summary><strong>Framework quick starts</strong></summary>

### React Native

```bash
npm install @askable-ui/react-native
```

```tsx
import { Pressable, Text } from 'react-native';
import { Askable, useAskable } from '@askable-ui/react-native';

function RevenueCard() {
  const { ctx, promptContext } = useAskable();

  return (
    <Askable ctx={ctx} meta={{ widget: 'revenue' }} text="Revenue card">
      <Pressable>
        <Text>Revenue</Text>
      </Pressable>
    </Askable>
  );
}
```

For a runnable mobile demo, see [`examples/react-native-expo`](./examples/react-native-expo).

### Vue 3

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
  <Askable :meta="{ metric: kpi.name, value: kpi.value }">
    <KPICard :data="kpi" />
  </Askable>
</template>
```

### Svelte

```bash
npm install @askable-ui/svelte
```

```svelte
<script>
  import { Askable, useAskable } from '@askable-ui/svelte';
  const { promptContext } = useAskable();
  export let kpi;
</script>

<Askable meta={{ metric: kpi.name, value: kpi.value }}>
  <KPICard data={kpi} />
</Askable>
```

### Vanilla JS

```bash
npm install @askable-ui/core
```

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document.body);

ctx.on('focus', () => {
  console.log(ctx.toPromptContext());
  // "User is focused on: — metric: revenue, value: $2.3M"
});
```

</details>

---

## Live links

- **Docs:** [askable-ui.com/docs](https://askable-ui.com/docs/)
- **Analytics dashboard demo:** [askable-mu.vercel.app](https://askable-mu.vercel.app/)

---

## Documentation

**[askable-ui.com/docs](https://askable-ui.com/docs/)**

| Guide | |
|---|---|
| [Getting started](https://askable-ui.com/docs/guide/getting-started) | Install, observe, inject |
| [Annotating elements](https://askable-ui.com/docs/guide/annotating) | `data-askable`, nesting, priority |
| [React](https://askable-ui.com/docs/guide/react) · [Vue](https://askable-ui.com/docs/guide/vue) · [Svelte](https://askable-ui.com/docs/guide/svelte) | Framework guides |
| [CopilotKit integration](https://askable-ui.com/docs/guide/copilotkit) | Context-in-input pattern |
| [API reference](https://askable-ui.com/docs/api/core) | Full type docs |

---

## Using with coding agents

[`AGENTS.md`](./AGENTS.md) contains copy-pasteable instructions for Claude, Cursor, Codex, and similar tools. Drop it into your project root and your coding agent will know how to integrate `askable-ui` correctly — annotation patterns, passive vs explicit flows, sanitization, and common mistakes.

---

## Contributing

PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions.

## License

MIT — see [LICENSE](./LICENSE)
