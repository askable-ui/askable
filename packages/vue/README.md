# @askable-ui/vue

Vue 3 bindings for [askable](../../README.md) — give your UI components LLM awareness in one line.

## Install

```bash
npm install @askable-ui/vue @askable-ui/core
```

## Quick Start

```vue
<script setup lang="ts">
import { Askable, useAskable } from '@askable-ui/vue';

const { focus, promptContext } = useAskable();

async function ask(question: string) {
  return fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [
        { role: 'system', content: `UI context: ${promptContext.value}` },
        { role: 'user', content: question },
      ],
    }),
  });
}
</script>

<template>
  <Askable :meta="{ chart: 'revenue', period: 'Q3', value: '$128k' }" as="section">
    <RevenueChart />
  </Askable>
</template>
```

## API

### `<Askable :meta="..." as="div">`

Renders any element (default: `div`) with a `data-askable` attribute.

### `useAskable(options?)`

Returns reactive focus state from the shared global context.

```ts
const { focus, promptContext, ctx } = useAskable();
// focus: Ref<AskableFocus | null>
// promptContext: ComputedRef<string>
// ctx: AskableContext

// Restrict which interactions trigger a context update
const { focus, promptContext } = useAskable({ events: ['click'] });
```

**Options:**
- `events?: AskableEvent[]` — trigger events: `'click'`, `'hover'`, `'focus'`. Defaults to all three.

**`ctx` advanced methods** (via `@askable-ui/core`):
- `ctx.select(el)` — programmatically set focus ("Ask AI" button pattern)
- `ctx.clear()` — reset focus to null and emit `'clear'` event
- `ctx.getHistory(limit?)` — focus history, newest first
- `ctx.toHistoryContext(limit?, options?)` — history as a prompt-ready string
- `ctx.toPromptContext(options?)` — full serialization options (format, maxTokens, excludeKeys, …)
- `ctx.serializeFocus(options?)` — structured `AskableSerializedFocus` object

### "Ask AI" button pattern

Use `ctx.select()` to set context explicitly when a user clicks a button:

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Askable, useAskable } from '@askable-ui/vue';

const { ctx } = useAskable();
const card = useTemplateRef('card');
</script>

<template>
  <Askable ref="card" :meta="data">
    <RevenueChart :data="data" />
    <button @click="ctx.select(card); openChat()">Ask AI ✦</button>
  </Askable>
</template>
```

## License

MIT


### SSR note

`useAskable()` is safe to use in SSR frameworks such as Nuxt. Observation starts on the client in `onMounted()`.
