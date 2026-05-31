---
layout: home

hero:
  name: "askable-ui"
  text: "UI context your LLM can actually use"
  tagline: Annotate any DOM element with data-askable and instantly turn what the user is looking at into structured, prompt-ready context.
  image:
    src: /avatar.png
    alt: askable-ui
  actions:
    - theme: brand
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
    title: Multiple interaction patterns
    details: Capture implicit focus, explicit Ask AI buttons, highlighted text, rectangular regions, circles, and freehand lasso selections as one structured context model.

  - icon: 🔌
    title: Works with agents and MCP
    details: toPromptContext() returns a plain string, while toContextPacket() returns structured Context packets for MCP bridges, browser tools, and agent runtimes.
---

> Current npm release: **v0.11.1**.
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

## Latest in v0.11.1

- lasso capture via `shape: 'lasso'` for freehand-selected page regions
- point-path metadata on lasso Context packets
- starter app dependency pins advanced to `^0.11.1`
- continued support for region/circle/text capture, MCP Context packets, and framework wrappers

## Interaction patterns

Askable can capture context at different levels of user intent:

| Pattern | Use it when | API |
| --- | --- | --- |
| Element focus | The user clicks, hovers, or tabs into annotated UI | `data-askable`, `ctx.observe()` |
| Ask AI button | A known widget should be selected before opening chat | `ctx.select(element)` |
| App event | Your code already knows the semantic object | `ctx.push(meta, text)` |
| Region | The user wants to mark a rectangular area | `createAskableRegionCapture()` |
| Circle | The user wants to point at an anomaly or object | `shape: 'circle'` |
| Lasso | The user wants to freehand-select an irregular area | `shape: 'lasso'` |
| Highlighted text | The user wants to send selected copy | `createAskableTextSelectionCapture()` |

Every pattern can produce a prompt string with `toPromptContext()` or a structured Context packet with `toContextPacket()`.

Start here:

- [What’s New in v0.11.1](/guide/whats-new)
- [Context Packets](/guide/context)
- [React interaction patterns](/guide/react#region-circle-and-lasso-capture)
- [AI SDK integration patterns](/examples/ai-sdk)
- [CopilotKit guide](/guide/copilotkit)

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
