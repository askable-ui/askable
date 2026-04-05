# @askable-ui/core

Framework-agnostic context tracker for LLM-aware UIs. Annotate DOM elements with `data-askable` attributes to expose structured context to language models, enabling AI assistants to understand what users are focused on and interacting with.

## Installation

```bash
npm install @askable-ui/core
```

## Quick Start

```html
<!-- Annotate elements with data-askable -->
<button data-askable='{"action":"submit","form":"checkout"}'>
  Complete Purchase
</button>

<input data-askable='{"field":"email","required":true}' placeholder="Email address" />
```

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();

// Start observing the document
ctx.observe(document);

// Listen for focus changes
ctx.on('focus', (focus) => {
  console.log('User focused on:', focus.meta);
  console.log('Element text:', focus.text);
});

// Get the current focus as an LLM prompt string
const prompt = ctx.toPromptContext();
// e.g. "User is focused on: — action: submit, form: checkout — value "Complete Purchase""

// Clean up when done
ctx.destroy();
```

## API Reference

### `createAskableContext(): AskableContext`

Factory function that creates and returns a new `AskableContext` instance. This is the recommended way to instantiate the context.

```ts
import { createAskableContext } from '@askable-ui/core';
const ctx = createAskableContext();
```

---

### `AskableContext`

The main interface for interacting with Askable.

#### `observe(root: HTMLElement | Document, options?: { events?: AskableEvent[]; hoverDebounce?: number; hoverThrottle?: number }): void`

Start observing a DOM subtree for `[data-askable]` elements. By default listens for `click`, `focus`, and `hover` events. Pass `events` to restrict which interactions trigger a context update.

```ts
// Observe the entire document (all trigger events)
ctx.observe(document);

// Only update context on click
ctx.observe(document, { events: ['click'] });

// Only update context on focus (keyboard navigation)
ctx.observe(document, { events: ['focus'] });

// Or observe a specific subtree
const panel = document.getElementById('main-panel');
ctx.observe(panel, { events: ['click', 'hover'] });

// Debounce hover updates until the pointer settles
ctx.observe(document, { events: ['hover'], hoverDebounce: 75 });

// Or throttle hover updates for dense UIs
ctx.observe(document, { events: ['hover'], hoverThrottle: 100 });
```

#### `unobserve(): void`

Stop observing and detach all event listeners added by `observe()`. Does not destroy the context — you can call `observe()` again afterward.

```ts
ctx.unobserve();
```

#### `getFocus(): AskableFocus | null`

Returns the current focus state, or `null` if no element has been interacted with yet.

```ts
const focus = ctx.getFocus();
if (focus) {
  console.log(focus.meta);      // Parsed data-askable value
  console.log(focus.text);      // Element text content
  console.log(focus.element);   // The HTMLElement
  console.log(focus.timestamp); // Unix ms when focus was set
}
```

#### `on<K>(event: K, handler: AskableEventHandler<K>): void`

Subscribe to an event. Currently the only event is `'focus'`, which fires whenever a `[data-askable]` element receives focus, is clicked, or is hovered.

```ts
ctx.on('focus', (focus) => {
  sendToLLM(ctx.toPromptContext());
});
```

#### `off<K>(event: K, handler: AskableEventHandler<K>): void`

Unsubscribe a previously registered handler.

```ts
const handler = (focus) => console.log(focus);
ctx.on('focus', handler);
// later...
ctx.off('focus', handler);
```

#### `toPromptContext(): string`

Serializes the current focus state into a natural language string suitable for inclusion in an LLM prompt. Returns `'No UI element is currently focused.'` when there is no current focus.

```ts
// With no focus:
ctx.toPromptContext();
// → "No UI element is currently focused."

// With a focused element:
// <button data-askable='{"action":"delete","target":"account"}'>Delete Account</button>
ctx.toPromptContext();
// → "User is focused on: — action: delete, target: account — value "Delete Account""

// With a plain string annotation:
// <section data-askable="pricing page hero">...</section>
ctx.toPromptContext();
// → "User is focused on: — pricing page hero — value "Get started for free...""
```

#### `select(element: HTMLElement): void`

Programmatically set focus to any element, as if the user had interacted with it. Useful for "Ask AI" buttons that explicitly set context before opening a chat.

```ts
const el = document.querySelector('[data-askable]');
ctx.select(el);

// Common pattern: "Ask AI" button sets context, then opens chat
document.querySelectorAll('.ask-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.closest('[data-askable]');
    ctx.select(target);
    openChat();
  });
});
```

#### `destroy(): void`

Tears down the entire context: stops observing, removes all event listeners, clears all event handlers, and resets focus state. Call this when the context is no longer needed (e.g., component unmount).

```ts
ctx.destroy();
```

---

### `AskableFocus`

The shape of focus state objects passed to event handlers and returned by `getFocus()`.

```ts
interface AskableFocus {
  meta: Record<string, unknown> | string; // Parsed data-askable value
  text: string;                            // Element text content
  element: HTMLElement;                    // The DOM element
  timestamp: number;                       // Unix ms
}
```

The `meta` field is parsed as JSON if possible; otherwise it is a raw string. This means you can use either form in your markup:

```html
<!-- JSON object (parsed to Record<string, unknown>) -->
<button data-askable='{"action":"save","section":"profile"}'>Save</button>

<!-- Plain string (kept as string) -->
<nav data-askable="main navigation">...</nav>
```

---

## Integration Examples

### React

```tsx
import { useEffect, useRef, useCallback } from 'react';
import { createAskableContext } from '@askable-ui/core';
import type { AskableFocus } from '@askable-ui/core';

function useAskable(onFocus?: (focus: AskableFocus) => void) {
  const ctxRef = useRef(createAskableContext());

  useEffect(() => {
    const ctx = ctxRef.current;
    ctx.observe(document);

    if (onFocus) {
      ctx.on('focus', onFocus);
    }

    return () => ctx.destroy();
  }, [onFocus]);

  return ctxRef.current;
}

// Usage in a component
export function App() {
  const handleFocus = useCallback((focus: AskableFocus) => {
    console.log('User is looking at:', focus.meta);
  }, []);

  const ctx = useAskable(handleFocus);

  async function askAssistant(question: string) {
    const context = ctx.toPromptContext();
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `UI context: ${context}` },
          { role: 'user', content: question },
        ],
      }),
    });
    return response.json();
  }

  return (
    <div>
      <button data-askable='{"action":"buy","item":"pro-plan"}'>
        Upgrade to Pro
      </button>
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import type { AskableFocus } from '@askable-ui/core';

const ctx = createAskableContext();
const currentFocus = ref<AskableFocus | null>(null);

onMounted(() => {
  ctx.observe(document);
  ctx.on('focus', (focus) => {
    currentFocus.value = focus;
  });
});

onUnmounted(() => {
  ctx.destroy();
});

function getPromptContext() {
  return ctx.toPromptContext();
}
</script>

<template>
  <div>
    <input
      data-askable='{"field":"search","scope":"products"}'
      placeholder="Search products..."
    />
    <p v-if="currentFocus">
      Focused: {{ JSON.stringify(currentFocus.meta) }}
    </p>
  </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createAskableContext } from '@askable-ui/core';
  import type { AskableFocus } from '@askable-ui/core';

  const ctx = createAskableContext();
  let currentFocus: AskableFocus | null = null;

  onMount(() => {
    ctx.observe(document);
    ctx.on('focus', (focus) => {
      currentFocus = focus;
    });
  });

  onDestroy(() => {
    ctx.destroy();
  });
</script>

<section data-askable='{"page":"dashboard","view":"analytics"}'>
  <h1>Analytics Dashboard</h1>
  <!-- content -->
</section>

{#if currentFocus}
  <p>Context: {ctx.toPromptContext()}</p>
{/if}
```

### Plain HTML

```html
<!DOCTYPE html>
<html>
<body>
  <nav data-askable="main navigation">
    <a href="/pricing" data-askable='{"page":"pricing"}'>Pricing</a>
    <a href="/docs" data-askable='{"page":"docs"}'>Docs</a>
  </nav>

  <main>
    <form data-askable='{"form":"signup","step":1}'>
      <input
        data-askable='{"field":"email","required":true}'
        type="email"
        placeholder="Email"
      />
      <button
        type="submit"
        data-askable='{"action":"submit","form":"signup"}'
      >
        Create Account
      </button>
    </form>
  </main>

  <script type="module">
    import { createAskableContext } from 'https://esm.sh/@askable-ui/core';

    const ctx = createAskableContext();
    ctx.observe(document);

    ctx.on('focus', () => {
      document.title = `Askable: ${ctx.toPromptContext()}`;
    });
  </script>
</body>
</html>
```

---

## LLM Integration

The primary use case is feeding UI context into LLM prompts so the AI assistant understands what the user is looking at.

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document);

async function askWithContext(userMessage: string) {
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
          content: [
            'You are a helpful UI assistant.',
            'Current UI context:',
            uiContext,
          ].join('\n'),
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  });

  return response.json();
}

// Example output when user clicks a delete button:
// uiContext = "User is focused on: — action: delete, target: account — value "Delete Account""
// The LLM can then provide context-aware help about account deletion.
```

---

## TypeScript Types Reference

```ts
import type {
  AskableContext,       // Main context interface
  AskableFocus,         // Focus state object
  AskableEvent,         // Trigger event type: 'click' | 'hover' | 'focus'
  AskableEventMap,      // Map of event names to payload types
  AskableEventName,     // Union of valid event names: 'focus'
  AskableEventHandler,  // Generic handler type
} from '@askable-ui/core';
```

## License

MIT
