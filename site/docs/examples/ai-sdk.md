# AI SDK Integration Patterns

Askable works with any LLM SDK. Here are drop-in patterns for the most common ones.

## Vercel AI SDK

```tsx
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages, uiContext } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system: [
      'You are a helpful UI assistant.',
      uiContext ? `Current UI context: ${uiContext}` : '',
    ].filter(Boolean).join('\n'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

```tsx
// components/Chat.tsx
'use client';
import { useChat } from 'ai/react';
import { useAskable } from '@askable-ui/react';

export function Chat() {
  const { promptContext } = useAskable();
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    body: { uiContext: promptContext },  // sent with every request
  });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map(m => (
        <div key={m.id}>{m.content}</div>
      ))}
      <input value={input} onChange={handleInputChange} />
      <button type="submit">Send</button>
    </form>
  );
}
```

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
  const { promptContext } = useAskable();

  async function ask(question: string) {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, uiContext: promptContext }),
    });
    return res.json();
  }
  // ...
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
