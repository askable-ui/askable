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

## Framework behaviour

### React (`useAskable`)

Observation starts inside a `useEffect`, which only runs on the client. The hook is safe to call in Server Components (it renders to `null` focus state) and in Client Components.

```tsx
// ✅ Safe in Next.js App Router
'use client';
import { useAskable } from '@askable-ui/react';

export function ChatInput() {
  const { promptContext } = useAskable();
  // On server: promptContext = 'No UI element is currently focused.'
  // On client: tracks real user interactions
}
```

### Vue (`useAskable`)

Observation starts in `onMounted()`, which is client-only. SSR renders receive `null` focus and the `'No UI element is currently focused.'` prompt string.

```ts
// ✅ Safe in Nuxt
const { promptContext } = useAskable();
// Server render: promptContext.value = 'No UI element is currently focused.'
```

### Svelte (`createAskableStore`)

`createAskableStore()` calls `observe()` immediately, but the `observe()` call is guarded. On the server, the stores initialize with `null` / `'No UI element is currently focused.'` and hydrate when the browser loads.

```ts
// ✅ Safe in SvelteKit
const { promptContext } = createAskableStore();
// Server: $promptContext = 'No UI element is currently focused.'
```

## What renders on the server

All adapters render a predictable initial state on the server:

| Value | Server |
|---|---|
| `focus` / `getFocus()` | `null` |
| `promptContext` / `toPromptContext()` | `'No UI element is currently focused.'` |
| `getHistory()` | `[]` |
| `toHistoryContext()` | `'No interaction history.'` |

This means your LLM calls still work on the server — they just receive the empty-state strings. If you need to guard against sending LLM requests with no context, check `focus !== null` before calling.

## Scoped contexts (React)

If you create a context instance manually and call `observe()` yourself, wrap it in a browser check or put it inside `useEffect` / `onMounted`:

```ts
import { createAskableContext } from '@askable-ui/core';

// ✅ Safe — observe() is a no-op outside browser
const ctx = createAskableContext();
ctx.observe(document); // no-op on server

// ✅ Explicit browser guard (not required, but explicit)
if (typeof window !== 'undefined') {
  ctx.observe(document);
}
```
