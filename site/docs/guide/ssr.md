# SSR Safety

All askable-ui packages are safe to use in server-side rendering environments (Next.js App Router, Nuxt, SvelteKit, etc.).

## How it works

`ctx.observe()` checks for browser globals before doing anything:

```ts
function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof MutationObserver !== 'undefined'
  );
}
```

If any of these are missing, `observe()` is a silent no-op. Creating a context on the server is safe — it just won't start tracking until the browser hydrates.

Each framework adapter also ensures the module-level global context is **never persisted across SSR requests**. When `window` is undefined, a fresh throwaway context is created per render, preventing state leakage between concurrent server requests.

## What renders on the server

All adapters render a predictable initial state on the server:

| Value | Server |
|---|---|
| `focus` / `getFocus()` | `null` |
| `promptContext` / `toPromptContext()` | `'No UI element is currently focused.'` |
| `getHistory()` | `[]` |
| `toHistoryContext()` | `'No interaction history.'` |

This means your LLM calls still work on the server — they just receive the empty-state strings. If you need to guard against sending LLM requests with no context, check `focus !== null` before calling.

---

## React — Next.js App Router

`useAskable()` observes the DOM only inside a `useEffect`, which never runs on the server. It is safe to call in any component tree.

```tsx
// app/dashboard/page.tsx — Server Component
// Components inside can use useAskable() — it silently returns no-focus state
export default function Page() {
  return <Dashboard />;
}
```

Components that call `useAskable()` must be Client Components:

```tsx
// components/ChatInput.tsx
'use client';
import { useAskable } from '@askable-ui/react';

export function ChatInput() {
  const { promptContext } = useAskable();
  // Server render: 'No UI element is currently focused.'
  // Client (after hydration): live focus context
}
```

The `<Askable>` component renders `data-askable` attributes during SSR — the HTML is present immediately and hydrates without a flash:

```tsx
// ✅ data-askable appears in server-rendered HTML
<Askable meta={{ widget: 'revenue-chart' }}>
  <RevenueChart />
</Askable>
```

**Concurrent request safety:** Each SSR render gets a fresh, independent context object. There is no cross-request state leakage, even under concurrent load.

---

## Vue — Nuxt

`useAskable()` starts observing in `onMounted()`, which is client-only. The composable is safe to call in Nuxt pages and layouts without any special configuration.

```ts
// pages/dashboard.vue
<script setup>
import { useAskable } from '@askable-ui/vue';

const { promptContext } = useAskable();
// Server render: promptContext.value = 'No UI element is currently focused.'
// Client (after hydration): live context
</script>
```

The `<Askable>` component renders correctly during SSR:

```vue
<template>
  <!-- data-askable is in server-rendered HTML -->
  <Askable :meta="{ widget: 'revenue-chart' }">
    <RevenueChart />
  </Askable>
</template>
```

If you need to branch on whether focus is set:

```ts
const { focus } = useAskable();

// Check before sending to LLM
const context = focus.value ? promptContext.value : null;
```

---

## Svelte — SvelteKit

`createAskableStore()` calls `observe()` immediately, but the call is guarded — it is a no-op on the server.

```ts
// +layout.svelte or +page.svelte
<script>
  import { createAskableStore } from '@askable-ui/svelte';

  const { focus, promptContext } = createAskableStore();
  // Server: $focus = null, $promptContext = 'No UI element is currently focused.'
  // Client (after hydration): live context
</script>
```

For SvelteKit with SSR, create the store in the component body (not at module level) to ensure each server request gets a fresh instance:

```ts
// ✅ Per-render instance — safe for concurrent requests
<script>
  import { createAskableStore } from '@askable-ui/svelte';
  const store = createAskableStore();
</script>

// ❌ Module-level — shared across all server requests
import { createAskableStore } from '@askable-ui/svelte';
const store = createAskableStore(); // runs once at import time
```

---

## Scoped contexts in SSR

If you create a context manually, `observe()` is already a no-op on the server:

```ts
import { createAskableContext } from '@askable-ui/core';

// ✅ Safe — observe() is a no-op outside browser
const ctx = createAskableContext();
ctx.observe(document);

// ✅ Explicit browser guard (optional)
if (typeof window !== 'undefined') {
  ctx.observe(document);
}
```

---

## Server/client privacy boundary

Askable captures data **entirely in the browser**. Nothing is automatically sent to your server. The flow is:

```
Browser                              Server / LLM
──────────────────────────────       ──────────────────────────
[data-askable] elements observed
      ↓
ctx.getFocus() → AskableFocus
      ↓
ctx.toPromptContext() → string  ──→  system prompt for LLM call
```

**What to be mindful of:**

1. **Sensitive meta** — if `data-askable` attributes contain PII or internal IDs, use `sanitizeMeta` to strip them before they reach the prompt. See [Sanitization](/guide/annotating#sanitization-and-redaction).

2. **Text content** — `text` is the trimmed `textContent` of the element. For elements that display sensitive user data (account numbers, addresses), use `sanitizeText` or a `textExtractor` that returns a safe label.

3. **Transport** — `promptContext` is a plain string. You decide when and whether to include it in your LLM call. It is never sent anywhere by askable-ui itself.

```ts
// Recommended server-side pattern: validate before forwarding
app.post('/api/chat', (req, res) => {
  const { context, question } = req.body;
  // context comes from the browser — treat it as user input
  const safeContext = context?.slice(0, 2000) ?? ''; // length-limit
  // pass to LLM
});
```
