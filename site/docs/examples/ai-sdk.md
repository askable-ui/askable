# AI SDK Integration Patterns

Askable works with any LLM SDK. Here are drop-in patterns for the most common ones.

## Vercel AI SDK

These examples target AI SDK 6: `ai@^6.0.286`, `@ai-sdk/openai@^3.0.114`, and the client package for your framework: `@ai-sdk/react@^3.0.289`, `@ai-sdk/vue@^3.0.286`, or `@ai-sdk/svelte@^4.0.286`. Keep provider credentials on the server.

All three clients use `DefaultChatTransport` and the same `/api/chat` endpoint. The endpoint accepts `UIMessage[]`, awaits `convertToModelMessages`, and returns a UI-message SSE stream, not plain text or a JSON response. Vue uses the SDK's `Chat` class, not `useChat`. The Svelte example requires **Svelte 5.31+**; it is not a Svelte 4 example. See the SDK's [Vue client source](https://github.com/vercel/ai/blob/ai%406.0.286/packages/vue/src/chat.vue.ts) and [Svelte client source](https://github.com/vercel/ai/blob/ai%406.0.286/packages/svelte/src/chat.svelte.ts).

Read context inside the send handler and pass it in `sendMessage`'s second argument. That captures the current focus and history for each request, including immediately after `ctx.select()` or `ctx.push()`.

::: code-group

```ts [API route]
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, generateId, streamText, type UIMessage } from 'ai';

export async function POST(req: Request) {
  const { messages, uiContext, historyContext } = await req.json() as {
    messages: UIMessage[];
    uiContext?: string;
    historyContext?: string;
  };

  const systemParts = ['You are a helpful UI assistant.'];
  if (uiContext) systemParts.push(`Current UI context:\n${uiContext}`);
  if (historyContext) systemParts.push(`Recent interactions:\n${historyContext}`);

  const result = streamText({
    model: openai.chat('gpt-4o-mini'),
    system: systemParts.join('\n\n'),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: generateId,
  });
}
```

```tsx [React client]
'use client';
import { useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAskable } from '@askable-ui/react';

export function Chat() {
  const { ctx } = useAskable();
  const [input, setInput] = useState('');
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
    <form onSubmit={handleSubmit}>
      {messages.map((m) => (
        <div key={m.id} className={`msg-${m.role}`}>
          {m.parts.map((part) => part.type === 'text' ? part.text : null)}
        </div>
      ))}
      {isLoading && <p role="status">Receiving response...</p>}
      {error && <p role="alert">Unable to complete the response. Please try again.</p>}
      <input value={input} onChange={(event) => setInput(event.target.value)} disabled={isLoading} placeholder="Ask..." />
      <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
      {isLoading && <button type="button" onClick={() => void stop()}>Stop</button>}
    </form>
  );
}
```

```vue [Vue client]
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Chat } from '@ai-sdk/vue';
import { DefaultChatTransport } from 'ai';
import { useAskable } from '@askable-ui/vue';

const { ctx } = useAskable();
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
</script>

<template>
  <form @submit.prevent="send">
    <div v-for="m in chat.messages" :key="m.id" :class="`msg-${m.role}`">
      <template v-for="(part, index) in m.parts" :key="index">
        <span v-if="part.type === 'text'">{{ part.text }}</span>
      </template>
    </div>
    <p v-if="isLoading" role="status">Receiving response...</p>
    <p v-if="chat.error" role="alert">Unable to complete the response. Please try again.</p>
    <input v-model="input" :disabled="isLoading" placeholder="Ask..." />
    <button type="submit" :disabled="isLoading || !input.trim()">Send</button>
    <button v-if="isLoading" type="button" @click="chat.stop()">Stop</button>
  </form>
</template>
```

```svelte [Svelte 5 client]
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import { createAskableStore } from '@askable-ui/svelte';

  const { ctx, destroy } = createAskableStore();
  const chat = new Chat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  let input = $state('');
  const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');
  onDestroy(() => { void chat.stop(); destroy(); });

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

<form onsubmit={send}>
  {#each chat.messages as m (m.id)}
    <div class="msg-{m.role}">
      {#each m.parts as part}
        {#if part.type === 'text'}{part.text}{/if}
      {/each}
    </div>
  {/each}
  {#if isLoading}<p role="status">Receiving response...</p>{/if}
  {#if chat.error}<p role="alert">Unable to complete the response. Please try again.</p>{/if}
  <input bind:value={input} disabled={isLoading} placeholder="Ask..." />
  <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
  {#if isLoading}<button type="button" onclick={() => chat.stop()}>Stop</button>{/if}
</form>
```

:::

The snippets render text parts only; add renderers before using tools, files, or other message parts. The server's type assertion documents the payload, but does not validate untrusted JSON. Add authentication, runtime message/context validation, request-size limits, and rate limits before deployment. Treat UI context as untrusted data, not instructions or authorization.

### Streaming updates during generation

The ordinary route above takes one context snapshot per request. Changing focus does **not** retroactively change the model call already generating tokens. For a custom multi-step agent, you can post debounced context updates for later model/tool steps. This requires an application-owned `/api/chat/context` endpoint and server-side session storage; neither is supplied by the route above or by Askable.

This complete client assigns a request ID in the send handler, before dispatch. It subscribes only while streaming, checks update responses, and cleans up pending updates on completion, failure, cancellation, or unmount. There is no SDK 6 `onResponse` callback involved.

```tsx
'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAskable } from '@askable-ui/react';

export function StreamingChat() {
  const { ctx } = useAskable();
  const [input, setInput] = useState('');
  const [contextError, setContextError] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onFinish() {
      requestIdRef.current = null;
    },
    onError() {
      requestIdRef.current = null;
    },
  });
  const isLoading = status === 'submitted' || status === 'streaming';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || isLoading || requestIdRef.current) return;
    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    setContextError(false);
    void sendMessage({ text: input.trim() }, {
      body: {
        requestId,
        uiContext: ctx.toPromptContext(),
        historyContext: ctx.toHistoryContext(5),
      },
    });
    setInput('');
  }

  useEffect(() => () => {
    requestIdRef.current = null;
    void stop();
  }, [stop]);

  useEffect(() => {
    const requestId = requestIdRef.current;
    if (status !== 'streaming' || !requestId) return;
    const controller = new AbortController();
    let sequence = 0;

    const unsubscribe = ctx.subscribeAsync(async (context) => {
      if (requestIdRef.current !== requestId) return;
      const response = await fetch('/api/chat/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ requestId, sequence: ++sequence, context }),
      });
      if (!response.ok) throw new Error(`Context update failed: ${response.status}`);
    }, {
      history: 5,
      debounce: 100,
      emitInitial: true,
      onError() {
        if (!controller.signal.aborted && requestIdRef.current === requestId) {
          setContextError(true);
        }
      },
    });

    return () => {
      unsubscribe();
      controller.abort();
    };
  }, [ctx, status]);

  return (
    <form onSubmit={handleSubmit}>
      {messages.map((m) => (
        <div key={m.id} className={`msg-${m.role}`}>
          {m.parts.map((part) => part.type === 'text' ? part.text : null)}
        </div>
      ))}
      {isLoading && <p role="status">Receiving response...</p>}
      {error && <p role="alert">Unable to complete the response. Please try again.</p>}
      {contextError && <p role="alert">Live context updates failed; later steps may use older context.</p>}
      <input value={input} onChange={(event) => setInput(event.target.value)} disabled={isLoading} placeholder="Ask..." />
      <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
      {isLoading && <button type="button" onClick={() => {
        requestIdRef.current = null;
        void stop();
      }}>Stop</button>}
    </form>
  );
}
```

The custom chat route must register the request before streaming. Authenticate both endpoints, bind `requestId` to the authenticated user, validate and bound `context`, accept only increasing `sequence` values, and reject updates for finished/expired requests. Store updates in shared storage if routes run in separate serverless instances. Do not treat a client-supplied request ID as authorization.

For an SDK multi-step tool loop, read the latest stored context in [`prepareStep`](https://github.com/vercel/ai/blob/ai%406.0.286/packages/ai/src/generate-text/prepare-step.ts) and return a new `system` value for the **next** step. Configure tools and stopping conditions separately. A single-step `streamText` call cannot consume later updates; stop and start a new request if the current answer must use new context. Aborting the client does not undo an update the server has already accepted.

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

Using the React client's `ctx` and `sendMessage` above, read both values at the point of sending:

```ts
function ask(question: string) {
  return sendMessage({ text: question }, {
    body: {
      uiContext: ctx.toPromptContext(),
      historyContext: ctx.toHistoryContext(5),
    },
  });
}
```

## Structured context with JSON format

When your backend needs to parse context, use `{ format: 'json' }`. Keep the serialized value in `uiContext` to use the same chat endpoint:

```ts
function askWithStructuredContext(question: string) {
  return sendMessage({ text: question }, {
    body: {
      uiContext: ctx.toPromptContext({ format: 'json' }),
      historyContext: ctx.toHistoryContext(5),
    },
  });
}
```

## Token budget

For models with tight system prompt limits, use `maxTokens` to prevent context overflow:

```ts
// Cap context at 150 tokens (~600 chars)
const uiContext = ctx.toPromptContext({ maxTokens: 150 });
const historyContext = ctx.toHistoryContext(10, { maxTokens: 300 });
```
