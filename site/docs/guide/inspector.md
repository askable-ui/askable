# Inspector / Dev Panel

`createAskableInspector` mounts a floating overlay panel on the page that shows what Askable is currently tracking — useful for development and for creating demos.

## What it shows

The panel updates in real time whenever the focused element changes:

```
┌─────────────────────────────────────────────┐
│ ✦ Askable Inspector                         │
├─────────────────────────────────────────────┤
│ Element                                     │
│   div#revenue-card.widget-card              │
│                                             │
│ Meta                                        │
│   {                                         │
│     metric: "revenue",                      │
│     value: "$2.3M",                         │
│     delta: "+12%"                           │
│   }                                         │
│                                             │
│ Text                                        │
│   Revenue: $2.3M                            │
│                                             │
│ Prompt context                              │
│   User is focused on: — metric: revenue,    │
│   value: $2.3M, delta: +12% — value         │
│   "Revenue: $2.3M"                          │
└─────────────────────────────────────────────┘
```

## Quick start

```ts
import { createAskableContext, createAskableInspector } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document);

// Mount the inspector — only do this in development
if (process.env.NODE_ENV === 'development') {
  createAskableInspector(ctx);
}
```

## Options

```ts
createAskableInspector(ctx, {
  position: 'bottom-right',  // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  highlight: true,           // outline the focused element
  promptOptions: {           // forwarded to toPromptContext()
    preset: 'compact',
  },
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `position` | `string` | `'bottom-right'` | Where to anchor the panel |
| `highlight` | `boolean` | `true` | Draw an outline on the focused element |
| `promptOptions` | `AskablePromptContextOptions` | — | Options for the prompt output preview |

## React

```tsx
// components/DevInspector.tsx
'use client';
import { useEffect } from 'react';
import { createAskableInspector } from '@askable-ui/core';
import { useAskable } from '@askable-ui/react';

export function DevInspector() {
  const { ctx } = useAskable();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const inspector = createAskableInspector(ctx, { position: 'bottom-left' });
    return () => inspector.destroy();
  }, [ctx]);

  return null;
}
```

```tsx
// app/layout.tsx
import { DevInspector } from '@/components/DevInspector';

export default function Layout({ children }) {
  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' && <DevInspector />}
    </>
  );
}
```

## Vue

```vue
<!-- components/DevInspector.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { createAskableInspector } from '@askable-ui/core';
import { useAskable } from '@askable-ui/vue';

const { ctx } = useAskable();
let handle: { destroy(): void } | null = null;

onMounted(() => {
  if (import.meta.env.DEV) {
    handle = createAskableInspector(ctx, { position: 'bottom-left' });
  }
});
onUnmounted(() => handle?.destroy());
</script>

<template></template>
```

## Cleanup

`createAskableInspector` returns a handle object with a `destroy()` method:

```ts
const inspector = createAskableInspector(ctx);

// Remove the panel and detach all listeners
inspector.destroy();
```

Calling `createAskableInspector` again while a panel is already visible replaces the existing panel — you won't end up with multiple overlays.

## Guards

Always guard the inspector behind a development check so it never ships to production:

```ts
// Vite / Next.js
if (import.meta.env.DEV) {
  createAskableInspector(ctx);
}

// Node environment variable
if (process.env.NODE_ENV === 'development') {
  createAskableInspector(ctx);
}
```
