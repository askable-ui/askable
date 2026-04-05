---
layout: home

hero:
  name: "askable-ui"
  text: "UI context your LLM can actually use"
  tagline: Annotate any DOM element with data-askable and instantly turn what the user is looking at into structured, prompt-ready context.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/core
    - theme: alt
      text: View on GitHub
      link: https://github.com/askable-ui/askable

features:
  - icon: ✦
    title: One attribute, full context
    details: Add data-askable to any element. The library tracks focus, click, and hover interactions and serializes exactly what the user is looking at into a string your LLM can act on.

  - icon: ⚡
    title: Framework-native bindings
    details: First-class hooks and components for React, Vue, and Svelte. Each binding is reactive, SSR-safe, and ships zero runtime dependencies beyond @askable-ui/core.

  - icon: 🎯
    title: Precision control
    details: Configure which events trigger updates, filter or reorder metadata keys, set token budgets, track multi-step focus history, and use select() for explicit "Ask AI" button patterns.

  - icon: 🔌
    title: Works with any LLM
    details: toPromptContext() returns a plain string — drop it into OpenAI, Anthropic, Vercel AI SDK, CopilotKit, or any LLM pipeline. No vendor lock-in.
---

## Quick look

::: code-group

```ts [Core]
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document);

// Anywhere in your AI handler:
ctx.toPromptContext();
// → "User is focused on: metric: revenue, delta: -12%, period: Q3"
```

```tsx [React]
import { useAskable, Askable } from '@askable-ui/react';

function Dashboard({ data }) {
  const { promptContext } = useAskable();

  return (
    <Askable meta={{ metric: 'revenue', delta: data.delta }}>
      <RevenueChart data={data} />
    </Askable>
  );
}
```

```vue [Vue]
<script setup>
import { useAskable, Askable } from '@askable-ui/vue';
const { promptContext } = useAskable();
</script>

<template>
  <Askable :meta="{ metric: 'revenue', delta: data.delta }">
    <RevenueChart :data="data" />
  </Askable>
</template>
```

```svelte [Svelte]
<script>
  import { createAskableStore, Askable } from '@askable-ui/svelte';
  const { promptContext } = createAskableStore();
</script>

<Askable meta={{ metric: 'revenue', delta: data.delta }}>
  <RevenueChart {data} />
</Askable>
```

:::
