# Plain JS / HTML

No framework needed. `@askable-ui/core` is zero-dependency and works in any environment.

## Install

```bash
npm install @askable-ui/core
```

Or via CDN (ESM):

```html
<script type="module">
  import { createAskableContext } from 'https://esm.sh/@askable-ui/core';
</script>
```

## Setup

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document);

ctx.on('focus', (focus) => {
  console.log('User is looking at:', focus.meta);
  console.log('Element text:', focus.text);
});
```

## Inject into an LLM call

```ts
async function askAssistant(userMessage: string) {
  const uiContext = ctx.toPromptContext();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful UI assistant.\n${uiContext}`,
        },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  return response.json();
}
```

## Full HTML example

```html
<!DOCTYPE html>
<html>
<body>
  <nav data-askable="main navigation">
    <a href="/pricing" data-askable='{"page":"pricing"}'>Pricing</a>
    <a href="/docs"    data-askable='{"page":"docs"}'>Docs</a>
  </nav>

  <main>
    <section data-askable='{"view":"dashboard","tab":"revenue"}'>
      <h1>Revenue</h1>
      <canvas id="chart"></canvas>
    </section>
  </main>

  <script type="module">
    import { createAskableContext } from 'https://esm.sh/@askable-ui/core';

    const ctx = createAskableContext();
    ctx.observe(document);

    // Wire to your chat UI
    document.getElementById('ask-btn').addEventListener('click', async () => {
      const question = document.getElementById('question').value;
      const context  = ctx.toPromptContext();

      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ question, context }),
      });

      const { answer } = await res.json();
      document.getElementById('answer').textContent = answer;
    });
  </script>
</body>
</html>
```

## Cleanup

Call `ctx.destroy()` to remove all listeners when the context is no longer needed:

```ts
// e.g. on SPA route change
window.addEventListener('beforeunload', () => ctx.destroy());
```
