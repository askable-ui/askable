# askable-ui + Vercel AI SDK

A minimal Next.js 15 app showing how **askable-ui** and **Vercel AI SDK 6** work together.

Click any metric card or deal row. The AI panel knows exactly what you're looking at — no screenshots, no form input, no extra wiring.

```
┌─────────────────────────────┬────────────────┐
│  Sales Dashboard            │  AI Assistant  │
│                             │                │
│  [Revenue $2.34M ↑12%]     │  Click a card, │
│  [ARR $9.1M      ↑8%]      │  then ask me   │
│  [Churn  2.1%    ↓0.4%]    │  about it →    │
│  [NPS    72      ↑5]        │                │
│                             │  The AI already│
│  ┌ Open Deals ──────────┐  │  sees your     │
│  │ Acme · Negotiation   │  │  context in    │
│  │ Globex · Proposal    │  │  real time.    │
│  └──────────────────────┘  │                │
└─────────────────────────────┴────────────────┘
```

## How it works

**1. Annotate elements** with `data-askable` (or the `<Askable>` wrapper):

```tsx
<Askable meta={{ id: 'revenue', value: '$2.34M', delta: '+12%' }}>
  <article>Revenue: $2.34M</article>
</Askable>

// For table rows (can't wrap <tr> in a component):
<tr data-askable={JSON.stringify({ id: 'd1', company: 'Acme', stage: 'Negotiation' })}>
```

**2. Grab the context** with `useAskable()`:

```tsx
const { promptContext } = useAskable();
// → "User is focused on: {"id":"revenue","value":"$2.34M","delta":"+12%"}"
```

**3. Send it with every AI request** using request-level options so the current context is captured at submission time:

```tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

const [input, setInput] = useState('');
const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});

// In the form submit handler:
sendMessage({ text: input }, { body: { uiContext: promptContext } });
setInput('');
// Render text from message.parts, and use status for loading state.
```

**4. Use it in your system prompt** on the server:

```ts
// app/api/chat/route.ts
import { convertToModelMessages, generateId, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { messages, uiContext } = await req.json();

const result = streamText({
  model: openai.chat('gpt-4o-mini'),
  system: `You are a dashboard assistant.\n\n${uiContext ?? 'Nothing focused.'}`,
  messages: await convertToModelMessages(messages),
});

return result.toUIMessageStreamResponse({ originalMessages: messages, generateMessageId: generateId });
```

That's the entire integration — four steps, no SDK-specific adapters needed.

See [the security migration notes](./SECURITY-MIGRATION.md) for dependency
selection, compatibility details, and secrets-free validation commands.

## Quickstart

```bash
# 1. Clone and install
git clone https://github.com/askable-ui/askable.git
cd askable/examples/vercel-ai-sdk
npm install

# 2. Set your OpenAI key
echo "OPENAI_API_KEY=sk-..." > .env.local

# 3. Start
npm run dev
# → http://localhost:3000
```

## Using with other AI providers

Swap out `@ai-sdk/openai` for any AI SDK provider — Anthropic, Google, Mistral, etc:

```ts
import { anthropic } from '@ai-sdk/anthropic';
// model: anthropic('claude-opus-4-8')
```

The `uiContext` string is provider-agnostic — it's just a plain string injected into the system prompt.

## Using with other AI frameworks

The `promptContext` string from `useAskable()` works anywhere:

```ts
// LangChain
const chain = ChatPromptTemplate.fromMessages([
  ['system', `Dashboard assistant.\n\n{uiContext}`],
  ['human', '{input}'],
]);

// OpenAI SDK directly
await openai.chat.completions.create({
  messages: [
    { role: 'system', content: `Dashboard assistant.\n\n${promptContext}` },
    ...history,
  ],
});
```
