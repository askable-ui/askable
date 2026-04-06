# Dashboard Assistant Example

A complete end-to-end example showing a multi-widget analytics dashboard where any element can be queried by an AI assistant.

## Overview

The pattern:

1. Annotate each dashboard widget with `data-askable` metadata
2. Track active focus with `useAskable` / `useAskable()` / `createAskableStore()`
3. Inject `promptContext` into every AI request
4. Optionally inject `historyContext` for a conversation-aware assistant

::: code-group

```tsx [React]
// components/Dashboard.tsx
'use client';
import { useRef, useState } from 'react';
import { Askable, useAskable } from '@askable-ui/react';
import { useChat } from 'ai/react';

const widgets = [
  { id: 'revenue', label: 'Revenue', value: '$2.3M', delta: '+12%', period: 'Q3 2024' },
  { id: 'churn',   label: 'Churn Rate', value: '4.2%', delta: '+0.3pp', period: 'Q3 2024' },
  { id: 'nps',     label: 'NPS', value: '61', delta: '+4', period: 'Q3 2024' },
];

export function Dashboard() {
  const { ctx, promptContext } = useAskable();
  const [chatOpen, setChatOpen] = useState(false);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  // Include last 5 interactions so the AI can answer follow-up questions
  const historyContext = ctx.toHistoryContext(5);

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    body: { uiContext: promptContext, historyContext },
  });

  return (
    <div className="dashboard">
      <div className="widgets">
        {widgets.map((w) => (
          <Askable
            key={w.id}
            meta={{ metric: w.id, value: w.value, delta: w.delta, period: w.period }}
            ref={(el) => { refs.current[w.id] = el; }}
            className="widget-card"
          >
            <h3>{w.label}</h3>
            <p className="value">{w.value}</p>
            <p className="delta">{w.delta}</p>
            <button
              className="ask-ai-btn"
              onClick={() => {
                ctx.select(refs.current[w.id]!);
                setChatOpen(true);
              }}
            >
              Ask AI ✦
            </button>
          </Askable>
        ))}
      </div>

      {chatOpen && (
        <aside className="chat-panel">
          <button className="close" onClick={() => { setChatOpen(false); ctx.clear(); }}>✕</button>
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className={`msg msg-${m.role}`}>{m.content}</div>
            ))}
          </div>
          <form onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about this metric…"
            />
            <button type="submit">Send</button>
          </form>
        </aside>
      )}
    </div>
  );
}
```

```vue [Vue]
<!-- components/Dashboard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { Askable, useAskable } from '@askable-ui/vue';
import { useChat } from '@ai-sdk/vue';

const widgets = [
  { id: 'revenue', label: 'Revenue',   value: '$2.3M', delta: '+12%',    period: 'Q3 2024' },
  { id: 'churn',   label: 'Churn Rate', value: '4.2%', delta: '+0.3pp',  period: 'Q3 2024' },
  { id: 'nps',     label: 'NPS',        value: '61',   delta: '+4',       period: 'Q3 2024' },
];

const { ctx, promptContext } = useAskable();
const chatOpen = ref(false);
const cardRefs = ref<Record<string, HTMLElement | null>>({});

const historyContext = computed(() => ctx.toHistoryContext(5));

const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
  body: computed(() => ({
    uiContext: promptContext.value,
    historyContext: historyContext.value,
  })),
});

function selectWidget(id: string) {
  const el = cardRefs.value[id];
  if (el) ctx.select(el);
  chatOpen.value = true;
}
</script>

<template>
  <div class="dashboard">
    <div class="widgets">
      <Askable
        v-for="w in widgets"
        :key="w.id"
        :ref="(el) => cardRefs[w.id] = el as HTMLElement"
        :meta="{ metric: w.id, value: w.value, delta: w.delta, period: w.period }"
        class="widget-card"
      >
        <h3>{{ w.label }}</h3>
        <p class="value">{{ w.value }}</p>
        <p class="delta">{{ w.delta }}</p>
        <button class="ask-ai-btn" @click="selectWidget(w.id)">Ask AI ✦</button>
      </Askable>
    </div>

    <aside v-if="chatOpen" class="chat-panel">
      <button class="close" @click="chatOpen = false; ctx.clear()">✕</button>
      <div class="messages">
        <div v-for="m in messages" :key="m.id" :class="`msg msg-${m.role}`">
          {{ m.content }}
        </div>
      </div>
      <form @submit.prevent="handleSubmit">
        <input v-model="input" placeholder="Ask about this metric…" />
        <button type="submit">Send</button>
      </form>
    </aside>
  </div>
</template>
```

```svelte [Svelte]
<!-- components/Dashboard.svelte -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  const widgets = [
    { id: 'revenue', label: 'Revenue',    value: '$2.3M', delta: '+12%',   period: 'Q3 2024' },
    { id: 'churn',   label: 'Churn Rate', value: '4.2%',  delta: '+0.3pp', period: 'Q3 2024' },
    { id: 'nps',     label: 'NPS',        value: '61',    delta: '+4',      period: 'Q3 2024' },
  ];

  const { ctx, promptContext, destroy } = createAskableStore();
  onDestroy(destroy);

  let chatOpen = false;
  let input = '';
  let messages: { id: string; role: string; content: string }[] = [];
  let cardEls: Record<string, HTMLElement> = {};

  $: historyContext = ctx.toHistoryContext(5);

  async function selectWidget(id: string) {
    ctx.select(cardEls[id]);
    chatOpen = true;
  }

  async function send() {
    if (!input.trim()) return;
    const userMsg = input;
    input = '';
    messages = [...messages, { id: crypto.randomUUID(), role: 'user', content: userMsg }];

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        uiContext: $promptContext,
        historyContext,
      }),
    });

    const data = await res.json();
    messages = [...messages, { id: crypto.randomUUID(), role: 'assistant', content: data.text }];
  }
</script>

<div class="dashboard">
  <div class="widgets">
    {#each widgets as w (w.id)}
      <Askable
        bind:el={cardEls[w.id]}
        meta={{ metric: w.id, value: w.value, delta: w.delta, period: w.period }}
        class="widget-card"
      >
        <h3>{w.label}</h3>
        <p class="value">{w.value}</p>
        <p class="delta">{w.delta}</p>
        <button class="ask-ai-btn" on:click={() => selectWidget(w.id)}>Ask AI ✦</button>
      </Askable>
    {/each}
  </div>

  {#if chatOpen}
    <aside class="chat-panel">
      <button class="close" on:click={() => { chatOpen = false; ctx.clear(); }}>✕</button>
      <div class="messages">
        {#each messages as m (m.id)}
          <div class="msg msg-{m.role}">{m.content}</div>
        {/each}
      </div>
      <form on:submit|preventDefault={send}>
        <input bind:value={input} placeholder="Ask about this metric…" />
        <button type="submit">Send</button>
      </form>
    </aside>
  {/if}
</div>
```

:::

## API route

All three examples above POST to `/api/chat` with `uiContext` and `historyContext`. Here's a Next.js App Router handler using the Vercel AI SDK:

```ts
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages, uiContext, historyContext } = await req.json();

  const systemParts = [
    'You are a helpful analytics assistant. Answer questions about the metrics the user is asking about.',
    'Be concise — one or two sentences is usually enough for a KPI question.',
  ];
  if (uiContext) systemParts.push(`\nThe user is currently looking at:\n${uiContext}`);
  if (historyContext) systemParts.push(`\nRecent interactions:\n${historyContext}`);

  const result = streamText({
    model: openai('gpt-4o'),
    system: systemParts.join('\n'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

## Passive hover tracking

If you prefer not to add "Ask AI" buttons, enable passive hover tracking instead. The AI always receives context for whatever the user is currently hovering over:

```ts
// One-time setup — usually at app root
ctx.observe(document, {
  events: ['click', 'hover'],
  hoverDebounce: 100,   // wait 100 ms before recording hover
});
```

With this setup, `promptContext` / `ctx.toPromptContext()` always reflects the last interacted element — no explicit button click needed.
