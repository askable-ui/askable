# askable-ui

[![npm](https://img.shields.io/npm/v/@askable-ui/core?color=6366f1&label=npm)](https://www.npmjs.com/package/@askable-ui/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@askable-ui/core?color=6366f1&label=~1kb)](https://bundlephobia.com/package/@askable-ui/core)
[![license](https://img.shields.io/npm/l/@askable-ui/core?color=6366f1)](./LICENSE)

> UI context your LLM can actually use.

Annotate any element with `data-askable`. Askable tracks what the user is interacting with and gives you a prompt-ready string to inject into any AI call — automatically.

```bash
npm install @askable-ui/react   # or vue / svelte / core
```

---

## How it works

**1. Annotate your UI**

```tsx
import { Askable } from '@askable-ui/react';

<Askable meta={{ metric: 'revenue', value: '$2.3M', delta: '+12%' }}>
  <RevenueChart data={data} />
</Askable>
```

**2. Read the context**

```tsx
import { useAskable } from '@askable-ui/react';

const { promptContext } = useAskable();
// "User is focused on: — metric: revenue, value: $2.3M, delta: +12%"
```

**3. Inject into your AI call**

```ts
// Works with any LLM SDK — Vercel AI, Anthropic, OpenAI, etc.
const result = streamText({
  model: openai('gpt-4o'),
  system: `You are a helpful assistant.\n\n${uiContext}`,
  messages,
});
```

`promptContext` updates automatically as the user interacts. No polling, no manual wiring.

---

## Features

- **Zero config** — one attribute, works instantly
- **Framework adapters** — React, Vue 3, Svelte (same API everywhere)
- **SSR safe** — observation defers to the client, import anywhere
- **~1 kb** — no runtime dependencies
- **Explicit select** — `ctx.select(el)` for "Ask AI" button patterns
- **History** — `ctx.toHistoryContext(5)` for multi-turn conversations
- **Redaction** — `sanitizeMeta` / `sanitizeText` hooks for sensitive data
- **Inspector** — floating dev panel to see what Askable is tracking

---

## Install

| Package | Use when |
|---|---|
| `@askable-ui/react` | React 18+ apps |
| `@askable-ui/vue` | Vue 3 apps |
| `@askable-ui/svelte` | Svelte / SvelteKit apps |
| `@askable-ui/core` | Vanilla JS or custom framework integration |

```bash
npm install @askable-ui/react
# or
npm install @askable-ui/vue
# or
npm install @askable-ui/svelte
# or
npm install @askable-ui/core
```

---

## Documentation

**[askable-ui.github.io/askable/docs →](https://askable-ui.github.io/askable/docs/)**

- [Getting Started](https://askable-ui.github.io/askable/docs/guide/getting-started)
- [React](https://askable-ui.github.io/askable/docs/guide/react) · [Vue](https://askable-ui.github.io/askable/docs/guide/vue) · [Svelte](https://askable-ui.github.io/askable/docs/guide/svelte)
- [Dashboard example](https://askable-ui.github.io/askable/docs/examples/dashboard)
- [CopilotKit integration](https://askable-ui.github.io/askable/docs/guide/copilotkit)
- [API reference](https://askable-ui.github.io/askable/docs/api/core)

---

## License

MIT — see [LICENSE](./LICENSE)
