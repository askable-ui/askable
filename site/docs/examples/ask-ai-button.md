# Ask AI Button Pattern

The "Ask AI" button pattern lets users explicitly trigger AI assistance for a specific UI element, rather than relying on passive hover or focus tracking. It's the most reliable way to ensure the AI always gets exactly the right context.

## How it works

1. User sees a data element (chart, table row, KPI card)
2. User clicks "Ask AI ✦" on that element
3. `ctx.select(element)` captures the element's context
4. Chat panel opens with the context already set
5. User asks a question — the LLM knows exactly what they're referring to

## React

```tsx
'use client';
import { useRef, useState } from 'react';
import { Askable, useAskable } from '@askable-ui/react';

function MetricCard({ data }: { data: MetricData }) {
  const { ctx, promptContext } = useAskable();
  const cardRef = useRef<HTMLDivElement>(null);
  const [chatOpen, setChatOpen] = useState(false);

  function handleAskAI() {
    ctx.select(cardRef.current!);
    setChatOpen(true);
  }

  return (
    <>
      <Askable meta={data} ref={cardRef} className="metric-card">
        <h3>{data.label}</h3>
        <p className="value">{data.value}</p>
        <p className="delta">{data.delta}</p>

        <button className="ask-ai-btn" onClick={handleAskAI}>
          Ask AI ✦
        </button>
      </Askable>

      {chatOpen && (
        <ChatPanel
          initialContext={promptContext}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}
```

## Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Askable, useAskable } from '@askable-ui/vue';

const props = defineProps<{ data: MetricData }>();
const { ctx } = useAskable();
const card = ref<HTMLElement | null>(null);
const chatOpen = ref(false);

function handleAskAI() {
  ctx.select(card.value!);
  chatOpen.value = true;
}
</script>

<template>
  <Askable ref="card" :meta="data">
    <h3>{{ data.label }}</h3>
    <p>{{ data.value }}</p>
    <button @click="handleAskAI">Ask AI ✦</button>
  </Askable>

  <ChatPanel v-if="chatOpen" @close="chatOpen = false" />
</template>
```

## Svelte

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  export let data: MetricData;

  const { ctx, promptContext, destroy } = createAskableStore();
  onDestroy(destroy);

  let cardEl: HTMLElement;
  let chatOpen = false;

  function handleAskAI() {
    ctx.select(cardEl);
    chatOpen = true;
  }
</script>

<Askable bind:el={cardEl} meta={data}>
  <h3>{data.label}</h3>
  <p>{data.value}</p>
  <button on:click={handleAskAI}>Ask AI ✦</button>
</Askable>

{#if chatOpen}
  <ChatPanel on:close={() => chatOpen = false} />
{/if}
```

## Multiple cards, one chat panel

A common pattern: many cards on a dashboard, one shared chat panel. Whichever card's button was last clicked becomes the context.

```tsx
function Dashboard({ metrics }) {
  const { ctx, promptContext } = useAskable();
  const [chatOpen, setChatOpen] = useState(false);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  return (
    <div className="dashboard">
      {metrics.map((metric) => (
        <Askable
          key={metric.id}
          meta={metric}
          ref={(el) => { refs.current[metric.id] = el; }}
        >
          <MetricChart data={metric} />
          <button
            onClick={() => {
              ctx.select(refs.current[metric.id]!);
              setChatOpen(true);
            }}
          >
            Ask AI ✦
          </button>
        </Askable>
      ))}

      {chatOpen && (
        <ChatPanel
          context={promptContext}
          onClose={() => {
            setChatOpen(false);
            ctx.clear(); // reset focus when panel closes
          }}
        />
      )}
    </div>
  );
}
```

## Sending context to the AI

In your chat API handler, receive and use the context:

```ts
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages, uiContext } = await req.json();

  const system = [
    'You are a helpful data analyst assistant.',
    uiContext && `The user is asking about: ${uiContext}`,
  ].filter(Boolean).join('\n');

  // pass system + messages to your LLM...
}
```

```tsx
// In your ChatPanel component
function ChatPanel({ context, onClose }) {
  async function sendMessage(text: string) {
    await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [...history, { role: 'user', content: text }],
        uiContext: context,
      }),
    });
  }
}
```
