# Qwik Guide

## Install

```bash
npm install @askable-ui/qwik @askable-ui/core
```

## Quick start

```tsx
// src/routes/index.tsx
import { component$ } from '@builder.io/qwik';
import { Askable, useAskable } from '@askable-ui/qwik';

export default component$(() => {
  const { promptContext } = useAskable();

  return (
    <>
      <Askable meta={{ metric: 'revenue', value: '$128k', period: 'Q3' }}>
        <article>$128k</article>
      </Askable>

      <p>Context: {promptContext.value}</p>
    </>
  );
});
```

## `<Askable>`

Renders a `div` (or any element via `as`) annotated with `data-askable`.

```tsx
// Object meta — recommended for structured data
<Askable meta={{ widget: 'churn-rate', value: '4.2%' }} scope="dashboard">
  <ChurnChart />
</Askable>

// String meta — fine for simple labels
<Askable meta="main navigation">
  <nav>...</nav>
</Askable>
```

## `useAskable(options?)`

Creates (or shares) a context and returns reactive Qwik signals.

```tsx
const askable = useAskable();
const { focus, promptContext, ctxRef } = askable;

// focus.value — current AskableFocus | null (signal)
// promptContext.value — serialized string (signal)
// ctxRef.value — AskableContext after the visible task mounts
```

All hooks in the same Qwik app share a single context instance by default (matched by name + events key), so source hooks automatically connect to the same focus stream.

The DOM-backed context is intentionally initialized in a visible task so SSR
never accesses `document`. Do not destructure `ctx` during component render,
because that reads before the visible task runs. Read `askable.ctx` from browser
actions, or use the stable `ctxRef` signal in lifecycle-aware code:

```tsx
const askable = useAskable();

// Browser action after mount
const readPrompt = () => askable.ctx.toPromptContext();

// Visible task or other reactive lifecycle code
const ctx = askable.ctxRef.value;
```

The stream, chat, history, source, and agent hooks resolve `ctxRef` when their
action/task runs rather than capturing a render-time value.

For SSR-to-browser resume, use QRL factories to create hook-owned runtime
contexts and reconstruct custom sources in the browser:

```tsx
import { $ } from '@builder.io/qwik';
import { createAskableContext } from '@askable-ui/core';

const askable = useAskable({ ctx$: $(() => createAskableContext()) });
const source = useAskableSource('stats', $(() => ({
  resolve: () => ({ count: 2 }),
})));
```

The hook observes and destroys contexts created by `ctx$`. Direct `ctx` and
source-object arguments remain supported for client-only mounts. Values wrapped
with `noSerialize` are intentionally not restored after an SSR resume.

## Sources

Sources expose app state to the AI. Register them once in a layout or root component and they're available in every AI handler.

### Page source

```tsx
import { component$, Slot } from '@builder.io/qwik';
import { useAskablePageSource } from '@askable-ui/qwik';

export default component$(() => {
  useAskablePageSource({ includeLinks: false });
  return <Slot />;
});
```

### Cart source

```tsx
import { component$ } from '@builder.io/qwik';
import { useAskableCartSource } from '@askable-ui/qwik';
import type { AskableCartItem } from '@askable-ui/qwik';

export const CartWidget = component$(() => {
  const { snapshot, addItem, removeItem, clearCart } = useAskableCartSource({
    items: [],
    totals: { currency: 'USD' },
  });

  return (
    <div>
      <p>{snapshot.value?.itemCount} items — {snapshot.value?.total}</p>
      <button onClick$={() => clearCart()}>Clear</button>
    </div>
  );
});
```

### Multistep / wizard source

```tsx
import { component$ } from '@builder.io/qwik';
import { useAskableMultistepSource } from '@askable-ui/qwik';

export const Checkout = component$(() => {
  const wizard = useAskableMultistepSource({
    steps: [
      { id: 'cart',     label: 'Cart' },
      { id: 'shipping', label: 'Shipping' },
      { id: 'payment',  label: 'Payment' },
      { id: 'confirm',  label: 'Confirm' },
    ],
  });

  return (
    <div>
      <p>Step {(wizard.snapshot.value?.currentIndex ?? 0) + 1} of {wizard.snapshot.value?.totalSteps}</p>
      <button onClick$={() => wizard.next()}>Next</button>
      <button onClick$={() => wizard.prev()}>Back</button>
    </div>
  );
});
```

### Notification source

```tsx
import { component$ } from '@builder.io/qwik';
import { useAskableNotificationSource } from '@askable-ui/qwik';

export const ToastManager = component$(() => {
  const { push, dismiss, notifications } = useAskableNotificationSource();

  return (
    <div>
      {notifications.value.map((n) => (
        <div key={n.id}>
          {n.message}
          <button onClick$={() => dismiss(n.id)}>×</button>
        </div>
      ))}
    </div>
  );
});
```

### Error source

```tsx
import { useAskableErrorSource } from '@askable-ui/qwik';

// In your error boundary or try/catch:
const { addError, clearErrors } = useAskableErrorSource();

try {
  await submitOrder();
} catch (e) {
  addError({ key: 'submit', message: (e as Error).message, severity: 'error' });
}
```

### Other sources

| Hook | Default id | Description |
|---|---|---|
| `useAskablePageSource` | `page` | Document title, URL, headings |
| `useAskableNavigationSource` | `navigation` | Route history |
| `useAskableFormSource` | `form` | Form field values and validation |
| `useAskableTableSource` | `table` | Data grid rows, columns, selection |
| `useAskableUserSource` | `user` | Authenticated user identity |
| `useAskableErrorSource` | `errors` | Recent application errors |
| `useAskableNotificationSource` | `notifications` | Active toasts and alerts |
| `useAskableCartSource` | `cart` | Shopping cart state |
| `useAskableMultistepSource` | `multistep` | Wizard/stepper progress |

## Streaming and chat

### `useAskableStream`

```tsx
import { component$ } from '@builder.io/qwik';
import { useAskableStream } from '@askable-ui/qwik';

export const AskButton = component$(() => {
  const { stream, content, isStreaming, status } = useAskableStream();

  return (
    <>
      {isStreaming.value && <span>Thinking…</span>}
      {content.value && <p>{content.value}</p>}
      <button
        disabled={isStreaming.value}
        onClick$={() =>
          stream('Explain what I am looking at', async (req, emit) => {
            const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(req),
            });
            const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              emit(value);
            }
          })
        }
      >
        Ask AI
      </button>
    </>
  );
});
```

### `useAskableChat`

```tsx
import { component$ } from '@builder.io/qwik';
import { useAskableChat } from '@askable-ui/qwik';

export const ChatPanel = component$(() => {
  const { messages, append, isStreaming, clearMessages } = useAskableChat({
    systemPrompt: (ctx) => `You are a helpful UI assistant.\n\nCurrent UI context:\n${ctx}`,
  });

  return (
    <div>
      <div>
        {messages.value.map((m) => (
          <div key={m.id} class={m.role}>
            {m.content}
          </div>
        ))}
      </div>

      <button
        disabled={isStreaming.value}
        onClick$={() =>
          append('What is this page about?', async (req, _msgs, emit) => {
            const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(req),
            });
            const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              emit(value);
            }
          })
        }
      >
        Ask
      </button>
      <button onClick$={() => clearMessages()}>Clear</button>
    </div>
  );
});
```

## Focus history

```tsx
import { component$ } from '@builder.io/qwik';
import { useAskableHistory } from '@askable-ui/qwik';

export const HistoryPanel = component$(() => {
  const { history } = useAskableHistory({ maxEntries: 5 });

  return (
    <ul>
      {history.value.map((f, i) => (
        <li key={i}>{JSON.stringify(f.meta)}</li>
      ))}
    </ul>
  );
});
```

## Server-side rendering

`useAskable` returns empty signals on the server — `focus.value` is `null` and `promptContext.value` is `''`. All DOM observation and source registration happens inside `useVisibleTask$`, which is browser-only. Qwik City apps with SSR are safe to use with any askable-ui hook.

## Agent requests

```tsx
import { useAskable } from '@askable-ui/qwik';

const { ctx } = useAskable();

// Build a structured request with context, focus, and optional packet
const req = await ctx.toAgentRequest('Why is revenue dropping?', {
  history: 3,
  packet: true,
});

await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(req),
});
```
