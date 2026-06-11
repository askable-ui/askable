# askable-ui — Zero-Install Vanilla JS Demo

A fully self-contained HTML file that demonstrates the core askable-ui concept with **no build step, no install, no server**.

## Running

```bash
# Option 1: just open in a browser
open examples/vanilla-chat/index.html

# Option 2: serve it
npx serve examples/vanilla-chat
```

Or [open it directly on GitHub](./index.html) — it loads `@askable-ui/core` from the CDN automatically.

## What it shows

| Feature | How |
|---|---|
| `data-askable` annotation | Every KPI card and deal row has structured JSON metadata |
| Focus tracking | Click any element — the "What the AI sees" panel updates instantly |
| Real context string | Shows the actual `toContext()` output that you'd pass to an LLM |
| Context-accurate AI | Mock responses use the real data from `data-askable` attributes |
| Copy context | One click copies the context string for pasting into any AI chat |

## How it works (the interesting part)

```html
<!-- This is all you need to annotate an element -->
<div data-askable='{"metric":"net revenue retention","value":"118%","delta":"+6pp QoQ"}'>
  <h2>118%</h2>
  <p>Net Revenue Retention</p>
</div>
```

```js
// Load from CDN — same package as npm install @askable-ui/core
import { createAskableContext } from 'https://esm.sh/@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document.body);

// When the user clicks the card above, this fires:
ctx.on('focus', () => {
  console.log(ctx.toContext());
  // → "User is focused on: metric=net revenue retention, value=118%, delta=+6pp QoQ"
});
```

That string is what you inject into your LLM's system prompt.

## Connecting to a real LLM

Replace the mock response handler with a real fetch:

```js
async function handleSend() {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${YOUR_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful analytics assistant.\n\n${currentContext}`,
        },
        { role: 'user', content: userQuestion },
      ],
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
}
```

## Related

- [React + CopilotKit starter](../../packages/create-askable-app/) — `npm create @askable-ui/app`
- [Vue 3 example](../vue-dashboard/)
- [Full docs](https://askable-ui.com/docs/)
