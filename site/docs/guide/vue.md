# Vue Guide

## Install

```bash
npm install @askable-ui/vue @askable-ui/core
```

## Quick start

```vue
<script setup lang="ts">
import { Askable, useAskable } from '@askable-ui/vue';

const { promptContext } = useAskable();

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
  <Askable :meta="{ metric: 'revenue', value: '$128k', period: 'Q3' }">
    <RevenueChart />
  </Askable>
</template>
```

## `<Askable>`

Renders any element (default: `div`) with `data-askable` set from `:meta`.

```vue
<!-- Object meta -->
<Askable :meta="{ widget: 'churn-rate', value: '4.2%' }">
  <ChurnChart />
</Askable>

<!-- String meta -->
<Askable meta="pricing page hero" as="section">
  <HeroSection />
</Askable>
```

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `meta` | `Record<string, unknown> \| string` | — | Metadata for the element |
| `as` | `string` | `"div"` | HTML element to render |

## `useAskable(options?)`

Composable that connects to the shared global context. Starts observing on mount, cleans up when all consumers unmount.

```ts
const { focus, promptContext, ctx } = useAskable();
// focus: Ref<AskableFocus | null>
// promptContext: ComputedRef<string>
// ctx: AskableContext

// Click only
const { focus } = useAskable({ events: ['click'] });
```

**Options:**
| Option | Type | Description |
|---|---|---|
| `events` | `AskableEvent[]` | Which events trigger updates. Defaults to `['click', 'hover', 'focus']`. |

**Returns:**
| Value | Type | Description |
|---|---|---|
| `focus` | `Ref<AskableFocus \| null>` | Reactive current focus |
| `promptContext` | `ComputedRef<string>` | Reactive prompt-ready context string |
| `ctx` | `AskableContext` | Underlying context for advanced use |

## "Ask AI" button pattern

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Askable, useAskable } from '@askable-ui/vue';

const { ctx } = useAskable();
const card = useTemplateRef<HTMLElement>('card');

function askAboutCard() {
  ctx.select(card.value!);
  openChatPanel();
}
</script>

<template>
  <Askable ref="card" :meta="data">
    <RevenueChart :data="data" />
    <button @click="askAboutCard">Ask AI ✦</button>
  </Askable>
</template>
```

## Nuxt / SSR

`useAskable()` is SSR-safe. Observation starts in `onMounted()` so no DOM access occurs during server render.

```ts
// Works in Nuxt without 'use client' / no special config
const { promptContext } = useAskable();
```
