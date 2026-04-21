---
layout: home

hero:
  name: "askable-ui"
  text: "Give your AI copilot eyes"
  tagline: Askable is the UI context layer that works on top of CopilotKit, Vercel AI SDK, and other LLM stacks. Annotate meaningful elements once, then send the user's real focus to your model.
  image:
    src: /avatar.png
    alt: askable-ui
  actions:
    - theme: brand
      text: Start with CopilotKit
      link: /guide/copilotkit
    - theme: alt
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Live Demo
      link: https://askable-mu.vercel.app/
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
    details: First-class hooks and components for React, React Native, Vue, and Svelte. Web bindings are reactive and SSR-safe; React Native ships a focused press-driven adapter on top of @askable-ui/core.

  - icon: 🎯
    title: Precision control
    details: Configure which events trigger updates, filter or reorder metadata keys, set token budgets, track multi-step focus history, and use select() for explicit "Ask AI" button patterns.

  - icon: 🔌
    title: Works with any LLM
    details: Start with CopilotKit when you want chat UI and actions, or drop Askable into Vercel AI SDK, OpenAI, Anthropic, and other model pipelines. Askable stays the context layer either way.
---

> Current npm release: **v0.6.0**.
>
> Need a breaking-release upgrade path? See [Migration Guides](/guide/migrations). Versioned docs are available at `/docs/<version>/`.

## Product video

<div style="margin: 1.5rem 0 2rem;">
  <video
    autoplay
    loop
    muted
    playsinline
    style="width: 100%; max-width: 960px; border-radius: 16px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18); background: #0f172a;"
  >
    <source src="https://askable-ui.com/askable-ui-code.mp4" type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## Recommended path

For the fastest route to a production UI copilot:

- use **Askable** for UI context (`promptContext`, `ctx.toHistoryContext()`, `ctx.select()`)
- use **CopilotKit** for chat UI, actions, and runtime orchestration

Start here: [CopilotKit integration guide](/guide/copilotkit)

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

```tsx [React Native]
import { Pressable, Text } from 'react-native';
import { useAskable, Askable } from '@askable-ui/react-native';

function RevenueCard() {
  const { ctx, promptContext } = useAskable();

  return (
    <Askable ctx={ctx} meta={{ metric: 'revenue' }} text="Revenue card">
      <Pressable>
        <Text>Revenue</Text>
      </Pressable>
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
