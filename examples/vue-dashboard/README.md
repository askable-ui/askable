# askable-ui — Vue 3 Dashboard Example

A minimal analytics dashboard showing the core askable-ui pattern in Vue 3.

## What it demonstrates

1. **`<Askable :meta="...">`** — wraps any element; keeps `data-askable` in sync with reactive props
2. **`useAskable()`** — one composable call; returns `promptContext` that updates automatically
3. **Live context panel** — shows exactly what the AI would receive as a string
4. **Mock chat** — demonstrates how `promptContext` makes AI responses specific and accurate

## Running

```bash
npm install
npm run dev
```

Then open http://localhost:5173, click any KPI card or deal row, and watch the "What the AI sees" panel update in real time.

## The core pattern

```vue
<script setup>
import { Askable, useAskable } from '@askable-ui/vue';

const { promptContext } = useAskable();
// promptContext is a ref<string> that updates automatically on click/focus
</script>

<template>
  <Askable :meta="{ metric: 'NRR', value: '118%', delta: '+6pp' }">
    <MetricCard :data="kpi" />
  </Askable>

  <!-- Pass promptContext to any LLM -->
  <AIChat :system-context="promptContext" />
</template>
```

## Connecting to a real LLM

Replace the mock `sendMessage()` function with a real API call:

```ts
async function sendMessage() {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: promptContext.value, // ← inject into system prompt
      message: chatInput.value,
    }),
  });
  // ...
}
```

Server-side (e.g. Express):

```ts
app.post('/api/chat', async (req, res) => {
  const { context, message } = req.body;
  const result = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `You are a helpful analytics assistant.\n\n${context}` },
      { role: 'user', content: message },
    ],
  });
  res.json({ reply: result.choices[0].message.content });
});
```

## Related

- [Vue package docs](https://askable-ui.com/docs/guide/vue)
- [React example](../analytics-dashboard-react/)
- [Vanilla JS example](../vanilla-chat/)
- [Full starter app](../../packages/create-askable-app/)
