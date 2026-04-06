# Explicit `select()` and Ask AI Buttons

Passive observation (hover/click/focus) is great for automatically tracking what the user is looking at. But many real products also need a **user-triggered, explicit** hand-off — an "Ask AI" button that sends context for the element the user consciously chose.

`ctx.select(element)` does exactly this: it programmatically sets focus to any `HTMLElement`, fires the `'focus'` event, and updates history — without requiring the user to click the annotated element.

## When to use `select()` vs passive observation

| Pattern | When to use |
|---|---|
| Passive observation | Always-on context — user browsing a dashboard, hover-to-ask interactions |
| `select()` | "Ask AI" button next to a widget; right-click → explain; keyboard shortcut for current selection |

Use both together: passive observation sets context as the user browses, and `select()` lets them explicitly pin a specific element before asking a question.

## Basic usage

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document);

const el = document.getElementById('revenue-chart')!;

document.getElementById('ask-btn')!.addEventListener('click', () => {
  ctx.select(el);
  openChatPanel(); // your chat UI
});
```

`select()` accepts any `HTMLElement`. It does not need to be inside the observed subtree, and it does not need `data-askable` to be set (though it must have the attribute for meaningful context).

## React

```tsx
import { useRef } from 'react';
import { Askable, useAskable } from '@askable-ui/react';

function RevenueCard({ data }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { ctx } = useAskable();

  return (
    <Askable meta={data} ref={cardRef}>
      <RevenueChart data={data} />
      <button
        onClick={() => {
          ctx.select(cardRef.current!);
          openChatPanel();
        }}
      >
        Ask AI ✦
      </button>
    </Askable>
  );
}
```

The `<Askable>` component forwards `ref` to the underlying DOM element so you can pass it directly to `select()`.

## Vue

```vue
<script setup>
import { ref } from 'vue';
import { Askable, useAskable } from '@askable-ui/vue';

const props = defineProps(['data']);
const card = ref(null);
const { ctx } = useAskable();

function askAboutCard() {
  ctx.select(card.value.$el);
  openChatPanel();
}
</script>

<template>
  <Askable :meta="data" ref="card">
    <RevenueChart :data="data" />
    <button @click="askAboutCard">Ask AI ✦</button>
  </Askable>
</template>
```

## Svelte

```svelte
<script>
  import { Askable, createAskableStore } from '@askable-ui/svelte';

  export let data;

  let card;
  const { ctx } = createAskableStore();

  function askAboutCard() {
    ctx.select(card);
    openChatPanel();
  }
</script>

<Askable meta={data} bind:element={card}>
  <RevenueChart {data} />
  <button on:click={askAboutCard}>Ask AI ✦</button>
</Askable>
```

## Combining with passive observation

`select()` and passive observation work together — each `select()` call is added to history alongside hover/click events:

```ts
ctx.on('focus', (focus) => {
  // fires on hover, click, focus events AND on ctx.select()
  updateChatContext(ctx.toPromptContext());
});
```

This means if the user hovers a chart, then clicks "Ask AI" on a table row, both are in history — the LLM can see the full interaction trail.

## Clearing after the conversation

After the user's question is answered, clear focus to indicate no element is actively selected:

```ts
chatPanel.on('close', () => ctx.clear());
```

The `'clear'` event fires, letting any reactive components reset their UI state.

## History-aware Ask AI

For multi-turn conversations, include recent focus history so the LLM can see what the user was exploring before clicking Ask AI:

```ts
document.getElementById('ask-btn').addEventListener('click', () => {
  ctx.select(currentCard);

  const systemPrompt = [
    'You are a dashboard assistant.',
    '',
    'Current selection:',
    ctx.toPromptContext(),
    '',
    'Recent interactions:',
    ctx.toHistoryContext(5),
  ].join('\n');

  sendToLLM(systemPrompt, userQuestion);
});
```
