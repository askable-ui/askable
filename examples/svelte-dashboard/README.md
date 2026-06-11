# askable-ui — Svelte 5 Dashboard Example

An analytics dashboard built with **Svelte 5 runes** and **askable-ui**, showing how your AI assistant can see exactly which metric or deal the user is looking at.

## What this shows

1. Click any KPI card or deal row — `askable-ui` captures that element's structured metadata
2. The **"What the AI sees"** panel updates in real time with `askable.promptContext`
3. The mock chat uses that context string to give accurate, element-aware answers

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Svelte 5 runes API

```svelte
<script lang="ts">
  import { useAskable } from '@askable-ui/svelte/useAskable.svelte';
  import Askable5 from '@askable-ui/svelte/Askable5.svelte';

  const askable = useAskable({ observe: true });
</script>

<!-- Wrap any element with structured metadata -->
<Askable5 meta={{ metric: 'nrr', value: 118 }}>
  <button onclick={(e) => askable.ctx.select(e.currentTarget)}>
    NRR: 118%
  </button>
</Askable5>

<!-- Read the live context string anywhere -->
<pre>{askable.promptContext}</pre>
```

## Wiring a real LLM

Replace the mock `sendMessage` function in `App.svelte` with a real API call:

```typescript
async function sendMessage() {
  const text = chatInput.trim();
  if (!text) return;
  chatInput = '';
  chatMessages = [...chatMessages, { role: 'user', text }];

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `You are a helpful AI assistant. Current UI context:\n\n${askable.promptContext}`,
        },
        { role: 'user', content: text },
      ],
    }),
  });

  const { reply } = await res.json();
  chatMessages = [...chatMessages, { role: 'ai', text: reply }];
}
```

Server-side (Node/Express):

```javascript
import OpenAI from 'openai';
const openai = new OpenAI();

app.post('/api/chat', async (req, res) => {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: req.body.messages,
  });
  res.json({ reply: completion.choices[0].message.content });
});
```

## Svelte 4 (store-based) alternative

If you're on Svelte 4, use the store API instead:

```svelte
<script lang="ts">
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  const store = createAskableStore({ observe: true });
</script>

<Askable meta={{ metric: 'nrr', value: 118 }}>
  <button on:click={(e) => store.ctx.select(e.currentTarget)}>
    NRR: 118%
  </button>
</Askable>

<pre>{$store.promptContext}</pre>
```
