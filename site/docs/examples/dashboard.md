# Dashboard Assistant Example

A complete end-to-end example showing a multi-widget analytics dashboard where any element can be queried by an AI assistant.

## Overview

The pattern:

1. Annotate each dashboard widget with `data-askable` metadata
2. Track active focus with `useAskable` / `useAskable()` / `createAskableStore()`
3. Add explicit tools for Ask AI buttons, region/circle/lasso capture, and highlighted text when the user needs more precise context than a single widget
4. Read current context when sending and pass it in the AI request body
5. Optionally inject `historyContext` or structured Context packets for a conversation-aware assistant

These examples use AI SDK 6 and the shared UI-message streaming route below. Use `ai@^6.0.286` with `@ai-sdk/react@^3.0.289`, `@ai-sdk/vue@^3.0.286`, or `@ai-sdk/svelte@^4.0.286`. The Svelte client requires **Svelte 5.31+**, not Svelte 4. See [AI SDK integration patterns](./ai-sdk) for the package/API details and production validation requirements.

::: code-group

```tsx [React]
// components/Dashboard.tsx
'use client';
import { useRef, useState, type FormEvent } from 'react';
import {
  Askable,
  useAskable,
  useAskableRegionCapture,
  useAskableTextSelectionCapture,
} from '@askable-ui/react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const widgets = [
  { id: 'revenue', label: 'Revenue', value: '$2.3M', delta: '+12%', period: 'Q3 2024' },
  { id: 'churn',   label: 'Churn Rate', value: '4.2%', delta: '+0.3pp', period: 'Q3 2024' },
  { id: 'nps',     label: 'NPS', value: '61', delta: '+4', period: 'Q3 2024' },
];

export function Dashboard() {
  const { ctx } = useAskable();
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState('');
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const region = useAskableRegionCapture({
    ctx,
    includeViewport: true,
    onCapture(packet, selection) {
      ctx.push(
        { capture: packet.capture.mode, shape: selection.shape, bounds: selection.bounds },
        `${selection.shape} selection on the dashboard`
      );
    },
  });
  const text = useAskableTextSelectionCapture({
    ctx,
    onCapture(packet, selection) {
      ctx.push({ capture: packet.capture.mode, length: selection.text.length }, selection.text);
    },
  });

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const isLoading = status === 'submitted' || status === 'streaming';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || isLoading) return;
    void sendMessage({ text: input.trim() }, {
      body: {
        uiContext: ctx.toPromptContext(),
        historyContext: ctx.toHistoryContext(5),
      },
    });
    setInput('');
  }

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

      <div className="selection-tools">
        <button onClick={() => region.start({ shape: 'region' })}>Select region</button>
        <button onClick={() => region.start({ shape: 'circle' })}>Circle anomaly</button>
        <button onClick={() => region.start({ shape: 'lasso' })}>Lasso area</button>
        <button onClick={() => text.captureNow({ dedupe: false })}>Send selected text</button>
      </div>

      {chatOpen && (
        <aside className="chat-panel">
          <button className="close" aria-label="Close chat" onClick={() => { void stop(); setChatOpen(false); ctx.clear(); }}>✕</button>
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className={`msg msg-${m.role}`}>
                {m.parts.map((part) => part.type === 'text' ? part.text : null)}
              </div>
            ))}
            {isLoading && <p role="status">Receiving response...</p>}
            {error && <p role="alert">Unable to complete the response. Please try again.</p>}
          </div>
          <form onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading}
              placeholder="Ask about this metric…"
            />
            <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
            {isLoading && <button type="button" onClick={() => void stop()}>Stop</button>}
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
import { ref, computed, onBeforeUnmount } from 'vue';
import { Askable, useAskable } from '@askable-ui/vue';
import { Chat } from '@ai-sdk/vue';
import { DefaultChatTransport } from 'ai';

const widgets = [
  { id: 'revenue', label: 'Revenue',   value: '$2.3M', delta: '+12%',    period: 'Q3 2024' },
  { id: 'churn',   label: 'Churn Rate', value: '4.2%', delta: '+0.3pp',  period: 'Q3 2024' },
  { id: 'nps',     label: 'NPS',        value: '61',   delta: '+4',       period: 'Q3 2024' },
];

const { ctx } = useAskable();
const chatOpen = ref(false);
const input = ref('');
const chat = new Chat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});
const isLoading = computed(() => chat.status === 'submitted' || chat.status === 'streaming');
onBeforeUnmount(() => { void chat.stop(); });

function send() {
  if (!input.value.trim() || isLoading.value) return;
  void chat.sendMessage({ text: input.value.trim() }, {
    body: {
      uiContext: ctx.toPromptContext(),
      historyContext: ctx.toHistoryContext(5),
    },
  });
  input.value = '';
}

function selectWidget(event: MouseEvent) {
  // Select the annotated DOM element, not the Vue component instance.
  const button = event.currentTarget as HTMLButtonElement;
  const el = button.closest<HTMLElement>('[data-askable]');
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
        :meta="{ metric: w.id, value: w.value, delta: w.delta, period: w.period }"
        class="widget-card"
      >
        <h3>{{ w.label }}</h3>
        <p class="value">{{ w.value }}</p>
        <p class="delta">{{ w.delta }}</p>
        <button class="ask-ai-btn" @click="selectWidget">Ask AI ✦</button>
      </Askable>
    </div>

    <aside v-if="chatOpen" class="chat-panel">
      <button class="close" aria-label="Close chat" @click="chat.stop(); chatOpen = false; ctx.clear()">✕</button>
      <div class="messages">
        <div v-for="m in chat.messages" :key="m.id" :class="`msg msg-${m.role}`">
          <template v-for="(part, index) in m.parts" :key="index">
            <span v-if="part.type === 'text'">{{ part.text }}</span>
          </template>
        </div>
        <p v-if="isLoading" role="status">Receiving response...</p>
        <p v-if="chat.error" role="alert">Unable to complete the response. Please try again.</p>
      </div>
      <form @submit.prevent="send">
        <input v-model="input" :disabled="isLoading" placeholder="Ask about this metric…" />
        <button type="submit" :disabled="isLoading || !input.trim()">Send</button>
        <button v-if="isLoading" type="button" @click="chat.stop()">Stop</button>
      </form>
    </aside>
  </div>
</template>
```

```svelte [Svelte 5]
<!-- components/Dashboard.svelte -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable5.svelte';

  const widgets = [
    { id: 'revenue', label: 'Revenue',    value: '$2.3M', delta: '+12%',   period: 'Q3 2024' },
    { id: 'churn',   label: 'Churn Rate', value: '4.2%',  delta: '+0.3pp', period: 'Q3 2024' },
    { id: 'nps',     label: 'NPS',        value: '61',    delta: '+4',      period: 'Q3 2024' },
  ];

  const { ctx, destroy } = createAskableStore();
  const chat = new Chat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  let chatOpen = $state(false);
  let input = $state('');
  const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');
  onDestroy(() => { void chat.stop(); destroy(); });

  function selectWidget(event: MouseEvent) {
    const button = event.currentTarget as HTMLButtonElement;
    const el = button.closest<HTMLElement>('[data-askable]');
    if (el) ctx.select(el);
    chatOpen = true;
  }

  function send(event: SubmitEvent) {
    event.preventDefault();
    if (!input.trim() || isLoading) return;
    void chat.sendMessage({ text: input.trim() }, {
      body: {
        uiContext: ctx.toPromptContext(),
        historyContext: ctx.toHistoryContext(5),
      },
    });
    input = '';
  }
</script>

<div class="dashboard">
  <div class="widgets">
    {#each widgets as w (w.id)}
      <Askable
        meta={{ metric: w.id, value: w.value, delta: w.delta, period: w.period }}
        class="widget-card"
      >
        <h3>{w.label}</h3>
        <p class="value">{w.value}</p>
        <p class="delta">{w.delta}</p>
        <button class="ask-ai-btn" onclick={selectWidget}>Ask AI ✦</button>
      </Askable>
    {/each}
  </div>

  {#if chatOpen}
    <aside class="chat-panel">
      <button class="close" aria-label="Close chat" onclick={() => { void chat.stop(); chatOpen = false; ctx.clear(); }}>✕</button>
      <div class="messages">
        {#each chat.messages as m (m.id)}
          <div class="msg msg-{m.role}">
            {#each m.parts as part}
              {#if part.type === 'text'}{part.text}{/if}
            {/each}
          </div>
        {/each}
        {#if isLoading}<p role="status">Receiving response...</p>{/if}
        {#if chat.error}<p role="alert">Unable to complete the response. Please try again.</p>{/if}
      </div>
      <form onsubmit={send}>
        <input bind:value={input} disabled={isLoading} placeholder="Ask about this metric…" />
        <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
        {#if isLoading}<button type="button" onclick={() => chat.stop()}>Stop</button>{/if}
      </form>
    </aside>
  {/if}
</div>
```

:::

## API route

All three examples above POST SDK `UIMessage[]` to `/api/chat` with current `uiContext` and `historyContext`. The transport decodes the UI-message SSE response and updates `messages`, `status`, and `error`; do not parse it with `res.json()` or concatenate the raw response bytes as assistant text. Here's a Next.js App Router handler using `@ai-sdk/openai@^3.0.114` (set `OPENAI_API_KEY` on the server):

```ts
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, generateId, streamText, type UIMessage } from 'ai';

export async function POST(req: Request) {
  const { messages, uiContext, historyContext } = await req.json() as {
    messages: UIMessage[];
    uiContext?: string;
    historyContext?: string;
  };

  const systemParts = [
    'You are a helpful analytics assistant. Answer questions about the metrics the user is asking about.',
    'Be concise — one or two sentences is usually enough for a KPI question.',
  ];
  if (uiContext) systemParts.push(`\nThe user is currently looking at:\n${uiContext}`);
  if (historyContext) systemParts.push(`\nRecent interactions:\n${historyContext}`);

  const result = streamText({
    model: openai.chat('gpt-4o-mini'),
    system: systemParts.join('\n'),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: generateId,
  });
}
```

The type assertion is not runtime validation. Authenticate requests, validate and limit messages/context, and apply rate limits before deployment. Context is untrusted data, not an authorization decision. These clients render text parts only.

## Passive hover tracking

If you prefer not to add "Ask AI" buttons, enable passive hover tracking instead. Each new request reads context for the most recently tracked element:

```ts
// One-time setup — usually at app root
ctx.observe(document, {
  events: ['click', 'hover'],
  hoverDebounce: 100,   // wait 100 ms before recording hover
});
```

With this setup, `promptContext` / `ctx.toPromptContext()` reflects the last tracked element after the hover debounce; no explicit button click is needed. Moving the pointer while an answer streams does not change the context already sent to the active model call. See [streaming updates during generation](./ai-sdk#streaming-updates-during-generation) for an application-owned multi-step update pattern.
