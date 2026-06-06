# AI SDK Integration Patterns

Askable works with any LLM SDK. Here are drop-in patterns for the most common ones.

## Vercel AI SDK

::: code-group

```ts [API route]
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages, uiContext, historyContext } = await req.json();

  const systemParts = ['You are a helpful UI assistant.'];
  if (uiContext) systemParts.push(`Current UI context:\n${uiContext}`);
  if (historyContext) systemParts.push(`Recent interactions:\n${historyContext}`);

  const result = streamText({
    model: openai('gpt-4o'),
    system: systemParts.join('\n\n'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

```tsx [React client]
'use client';
import { useChat } from 'ai/react';
import { useAskable } from '@askable-ui/react';

export function Chat() {
  const { ctx, promptContext } = useAskable();

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    body: {
      uiContext: promptContext,
      historyContext: ctx.toHistoryContext(5),
    },
  });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map((m) => (
        <div key={m.id} className={`msg-${m.role}`}>{m.content}</div>
      ))}
      <input value={input} onChange={handleInputChange} placeholder="Ask…" />
      <button type="submit">Send</button>
    </form>
  );
}
```

```vue [Vue client]
<script setup lang="ts">
import { computed } from 'vue';
import { useChat } from '@ai-sdk/vue';
import { useAskable } from '@askable-ui/vue';

const { ctx, promptContext } = useAskable();

const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
  body: computed(() => ({
    uiContext: promptContext.value,
    historyContext: ctx.toHistoryContext(5),
  })),
});
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div v-for="m in messages" :key="m.id" :class="`msg-${m.role}`">{{ m.content }}</div>
    <input v-model="input" placeholder="Ask…" />
    <button type="submit">Send</button>
  </form>
</template>
```

```svelte [Svelte client]
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createAskableStore } from '@askable-ui/svelte';

  const { ctx, promptContext, destroy } = createAskableStore();
  onDestroy(destroy);

  let messages: { id: string; role: string; content: string }[] = [];
  let input = '';

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
        historyContext: ctx.toHistoryContext(5),
      }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let reply = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      reply += decoder.decode(value);
    }
    messages = [...messages, { id: crypto.randomUUID(), role: 'assistant', content: reply }];
  }
</script>

<form on:submit|preventDefault={send}>
  {#each messages as m (m.id)}
    <div class="msg-{m.role}">{m.content}</div>
  {/each}
  <input bind:value={input} placeholder="Ask…" />
  <button type="submit">Send</button>
</form>
```

:::

### Streaming updates during generation

When a response is already streaming, you can keep the server-side session fresh by subscribing to Askable context changes and posting debounced updates tied to the active chat request.

```tsx
'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useChat } from 'ai/react';
import { useAskable } from '@askable-ui/react';

export function StreamingChat() {
  const { ctx, promptContext } = useAskable();
  const requestIdRef = useRef<string | null>(null);

  const chatBody = useMemo(() => ({
    requestId: crypto.randomUUID(),
    uiContext: promptContext,
    historyContext: ctx.toHistoryContext(5),
  }), [ctx, promptContext]);

  const { status, ...chat } = useChat({
    api: '/api/chat',
    body: chatBody,
    onResponse() {
      requestIdRef.current = chatBody.requestId;
    },
    onFinish() {
      requestIdRef.current = null;
    },
  });

  useEffect(() => {
    if (status !== 'streaming') return;

    return ctx.subscribeAsync(async (context) => {
      if (!requestIdRef.current) return;
      await fetch('/api/chat/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestIdRef.current,
          context,
        }),
      });
    }, {
      history: 5,
      sources: [{ id: 'accounts', mode: 'summary', timeoutMs: 750 }],
      debounce: 100,
      onError(error) {
        console.error(error);
      },
    });
  }, [ctx, status]);

  return <ChatUI {...chat} />;
}
```

On the server, store these incremental updates by `requestId` and let your streaming route read the latest Askable context between model/tool steps.

## Anthropic SDK

```ts
// server-side handler
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function askWithContext(userMessage: string, uiContext: string) {
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: `You are a helpful UI assistant.\n\n${uiContext}`,
    messages: [{ role: 'user', content: userMessage }],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}
```

```tsx
// client component
import { useAskable } from '@askable-ui/react';

function AskButton() {
  const { ctx } = useAskable();

  async function ask(question: string) {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await ctx.toAgentRequest(question, {
        history: 3,
        packet: true,
      })),
    });
    return res.json();
  }
  // ...
}
```

Server routes can read the same payload shape regardless of provider:

```ts
import { isAskableAgentRequest } from '@askable-ui/core';

export async function POST(req: Request) {
  const body = await req.json();
  if (!isAskableAgentRequest(body)) {
    return Response.json({ error: 'Invalid Askable request' }, { status: 400 });
  }

  const answer = await askWithContext(body.question, body.context);

  return Response.json({
    answer,
    requestId: body.requestId,
    receivedContextPacket: Boolean(body.packet),
    focusMeta: body.focus?.meta ?? null,
  });
}
```

## OpenAI SDK

```ts
import OpenAI from 'openai';

const openai = new OpenAI();

export async function askWithContext(userMessage: string, uiContext: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a helpful UI assistant.\n\n${uiContext}`,
      },
      { role: 'user', content: userMessage },
    ],
  });

  return response.choices[0].message.content;
}
```

## Including history

For multi-step conversations, inject the last N interactions alongside the current focus:

```ts
// In your API handler
export async function POST(req: Request) {
  const { messages, uiContext, historyContext } = await req.json();

  const systemParts = ['You are a helpful UI assistant.'];
  if (uiContext) systemParts.push(`Current focus:\n${uiContext}`);
  if (historyContext) systemParts.push(`Recent interactions:\n${historyContext}`);

  // pass to your LLM...
}
```

```ts
// In your client component
const { promptContext, ctx } = useAskable();

async function ask(question: string) {
  await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [...],
      uiContext: promptContext,
      historyContext: ctx.toHistoryContext(5),
    }),
  });
}
```

## Structured context with JSON format

When your backend needs to parse or log the context, use `{ format: 'json' }`:

```ts
const { ctx } = useAskable();

// Returns '{"meta":{"metric":"revenue"},"text":"Revenue","timestamp":...}'
const structuredContext = ctx.toPromptContext({ format: 'json' });

await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [...],
    context: JSON.parse(structuredContext),  // parsed object
  }),
});
```

## Token budget

For models with tight system prompt limits, use `maxTokens` to prevent context overflow:

```ts
// Cap context at 150 tokens (~600 chars)
const uiContext = ctx.toPromptContext({ maxTokens: 150 });
const historyContext = ctx.toHistoryContext(10, { maxTokens: 300 });
```
