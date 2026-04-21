# Getting Started

## Pick your framework

> Current npm release: **v6.1.0**.
>
> Latest docs live at `/docs/`. Version-specific docs are published at `/docs/<version>/` for breaking releases.

::: code-group

```bash [React]
npm install @askable-ui/react @askable-ui/core
```

```bash [React Native]
npm install @askable-ui/react-native @askable-ui/core
```

```bash [Vue]
npm install @askable-ui/vue @askable-ui/core
```

```bash [Svelte]
npm install @askable-ui/svelte @askable-ui/core
```

```bash [Plain JS]
npm install @askable-ui/core
```

:::

## Step 1 — Annotate elements

Add `data-askable` to any element whose context matters to your AI. The value can be a JSON object or a plain string.

```html
<!-- JSON object — recommended for structured data -->
<div data-askable='{"metric":"revenue","delta":"-12%","period":"Q3"}'>
  <RevenueChart />
</div>

<!-- Plain string — fine for simple labels -->
<nav data-askable="main navigation">...</nav>
```

With framework components, use the `<Askable>` wrapper instead of writing the attribute by hand:

::: code-group

```tsx [React]
import { Askable } from '@askable-ui/react';

<Askable meta={{ metric: 'revenue', delta: '-12%', period: 'Q3' }}>
  <RevenueChart />
</Askable>
```

```tsx [React Native]
import { Pressable, Text } from 'react-native';
import { Askable, useAskable } from '@askable-ui/react-native';

function RevenueCard() {
  const { ctx } = useAskable();

  return (
    <Askable ctx={ctx} meta={{ metric: 'revenue', delta: '-12%', period: 'Q3' }} text="Revenue card">
      <Pressable>
        <Text>Revenue</Text>
      </Pressable>
    </Askable>
  );
}
```

```vue [Vue]
<Askable :meta="{ metric: 'revenue', delta: '-12%', period: 'Q3' }">
  <RevenueChart />
</Askable>
```

```svelte [Svelte]
<Askable meta={{ metric: 'revenue', delta: '-12%', period: 'Q3' }}>
  <RevenueChart />
</Askable>
```

:::

## Step 2 — Observe the page

One call covers your entire document. The observer automatically picks up dynamically rendered elements via `MutationObserver`, and it also responds when existing elements gain/lose `data-askable` or update `data-askable-text` / `data-askable-priority`.

::: code-group

```tsx [React]
import { useAskable } from '@askable-ui/react';

function App() {
  const { promptContext } = useAskable(); // starts observing automatically
  // ...
}
```

```ts [React Native]
import { useAskable } from '@askable-ui/react-native';

const { promptContext } = useAskable();
// promptContext updates when Askable-wrapped press targets are pressed or long-pressed
```

```ts [Vue]
import { useAskable } from '@askable-ui/vue';

const { promptContext } = useAskable(); // starts observing on mount
```

```ts [Svelte]
import { createAskableStore } from '@askable-ui/svelte';

const { promptContext, destroy } = createAskableStore();
onDestroy(destroy);
```

```ts [Plain JS]
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document);
```

:::

## Step 3 — Inject into your LLM call

Pass `promptContext` (or `ctx.toPromptContext()`) as a system message before any user question:

```ts
async function ask(userMessage: string) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant.\nUI context: ${promptContext}`,
        },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  return response.json();
}
```

When the user clicks a revenue chart and asks *"why is this dropping?"*, `promptContext` becomes:

```
User is focused on: metric: revenue, delta: -12%, period: Q3
```

The LLM now has the context to give a precise, relevant answer.

## What's next

- [How It Works](/guide/how-it-works) — internals and architecture
- [Annotating Elements](/guide/annotating) — all ways to use `data-askable`
- [Prompt Serialization](/guide/serialization) — `toPromptContext()` options, token budgets, JSON format
- [Focus & History](/guide/focus-history) — tracking multi-step interactions
