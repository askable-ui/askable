# SolidJS Guide

## Install

```bash
npm install @askable-ui/solid @askable-ui/core
```

## Quick start

```tsx
// src/App.tsx
import { Askable, useAskable } from '@askable-ui/solid';

export function App() {
  const { promptContext } = useAskable();

  return (
    <>
      <Askable meta={{ metric: 'revenue', value: '$128k', period: 'Q3' }}>
        <article>$128k</article>
      </Askable>

      <p>Context: {promptContext()}</p>
    </>
  );
}
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

Creates (or shares) a context and returns reactive accessor functions.

```tsx
const { focus, promptContext, ctx } = useAskable();

// focus()       — current AskableFocus | null (accessor)
// promptContext() — serialized string (accessor)
// ctx           — raw AskableContext for advanced usage
```

All hooks in the same SolidJS app share a single context instance by default (matched by name + events key), so source hooks connect automatically without passing `ctx` around.

## Sources

Sources expose app state to the AI. Register them once in a layout or root component and they're available everywhere.

### Page source

```tsx
import { useAskablePageSource } from '@askable-ui/solid';

function Root() {
  useAskablePageSource({ includeLinks: false });
  // ...
}
```

### Cart source

```tsx
import { useAskableCartSource } from '@askable-ui/solid';
import type { AskableCartItem } from '@askable-ui/solid';

export function CartWidget() {
  const { snapshot, addItem, removeItem, updateQuantity, clearCart } = useAskableCartSource({
    items: [],
    totals: { currency: 'USD' },
  });

  return (
    <div>
      <p>{snapshot()?.itemCount} items — {snapshot()?.total}</p>
      <button onClick={() => clearCart()}>Clear</button>
    </div>
  );
}
```

### Multistep / wizard source

```tsx
import { useAskableMultistepSource } from '@askable-ui/solid';

export function Checkout() {
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
      <p>
        Step {(wizard.snapshot()?.currentIndex ?? 0) + 1} of{' '}
        {wizard.snapshot()?.totalSteps}
      </p>
      <button onClick={() => wizard.next()}>Next</button>
      <button onClick={() => wizard.prev()}>Back</button>
    </div>
  );
}
```

### Notification source

```tsx
import { createSignal } from 'solid-js';
import { useAskableNotificationSource } from '@askable-ui/solid';
import type { AskableNotification } from '@askable-ui/solid';

export function ToastManager() {
  const [toasts, setToasts] = createSignal<AskableNotification[]>([]);
  useAskableNotificationSource({ notifications: toasts });

  return (
    <For each={toasts()}>
      {(n) => (
        <div>
          {n.message}
          <button onClick={() => setToasts((t) => t.filter((x) => x.id !== n.id))}>×</button>
        </div>
      )}
    </For>
  );
}
```

### Error source

```tsx
import { useAskableErrorSource } from '@askable-ui/solid';

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
| `useAskableMediaSource` | `media` | Audio/video playback state |
| `useAskableScrollSource` | `scroll` | Scroll position and direction |
| `useAskableNetworkSource` | `network` | Connection type and online status |
| `useAskableThemeSource` | `theme` | Color scheme, motion, contrast |
| `useAskableWindowSource` | `window` | Viewport size and device category |
| `useAskableStorageSource` | `storage` | localStorage / sessionStorage |
| `useAskableGeolocationSource` | `geolocation` | User coordinates |
| `useAskableBatterySource` | `battery` | Device battery level |
| `useAskableFeatureFlagSource` | `featureFlags` | Feature flag values |
| `useAskableAbTestSource` | `abTests` | A/B test variant assignments |
| `useAskableAnalyticsSource` | `analytics` | Recent analytics events |
| `useAskableLoadingSource` | `loading` | In-flight request states |
| `useAskableIdleSource` | `idle` | User idle / active state |
| `useAskableSearchSource` | `search` | Search query and results |
| `useAskableTabSource` | `tabs` | Active tab and tab list |
| `useAskablePermissionSource` | `permissions` | Browser permission states |
| `useAskableLocaleSource` | `locale` | User locale and timezone |
| `useAskableTimeSource` | `time` | Current time and business hours |
| `useAskableFocusSource` | `focusedElement` | Currently focused DOM element |
| `useAskableConnectionSource` | `connection` | WebSocket / EventSource status |
| `useAskablePerformanceSource` | `performance` | Core Web Vitals and timing |
| `useAskableClipboardSource` | `clipboard` | Recent clipboard entries |
| `useAskableSelectionSource` | `selection` | Text selection |
| `useAskableDOMSource` | `dom` | DOM structure snapshot |

## Streaming and chat

### `useAskableStream`

```tsx
import { useAskableStream } from '@askable-ui/solid';

export function AskButton() {
  const { stream, content, isStreaming } = useAskableStream();

  return (
    <>
      {isStreaming() && <span>Thinking…</span>}
      {content() && <p>{content()}</p>}
      <button
        disabled={isStreaming()}
        onClick={() =>
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
}
```

### `useAskableChat`

```tsx
import { For } from 'solid-js';
import { useAskableChat } from '@askable-ui/solid';

export function ChatPanel() {
  const { messages, append, isStreaming, clearMessages } = useAskableChat({
    systemPrompt: (ctx) => `You are a helpful UI assistant.\n\nCurrent UI context:\n${ctx}`,
  });

  return (
    <div>
      <For each={messages()}>
        {(m) => <div class={m.role}>{m.content}</div>}
      </For>

      <button
        disabled={isStreaming()}
        onClick={() =>
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
      <button onClick={() => clearMessages()}>Clear</button>
    </div>
  );
}
```

## Focus history

```tsx
import { For } from 'solid-js';
import { useAskableHistory } from '@askable-ui/solid';

export function HistoryPanel() {
  const { history } = useAskableHistory({ maxEntries: 5 });

  return (
    <ul>
      <For each={history()}>
        {(f) => <li>{JSON.stringify(f.meta)}</li>}
      </For>
    </ul>
  );
}
```

## Region and text selection capture

```tsx
import { useAskableRegionCapture, useAskableTextSelectionCapture } from '@askable-ui/solid';

export function CaptureControls() {
  const region = useAskableRegionCapture();
  const selection = useAskableTextSelectionCapture();

  return (
    <div>
      <button onClick={() => region.start()}>Capture region</button>
      <button onClick={() => selection.captureNow()}>Capture selection</button>
      {region.active() && <span>Selecting…</span>}
    </div>
  );
}
```

## Keyboard shortcuts

```tsx
import { useAskableKeyboardShortcut } from '@askable-ui/solid';

export function ShortcutHandler() {
  useAskableKeyboardShortcut({
    keys: ['Meta+k', 'Control+k'],
    onTrigger: () => console.log('shortcut fired', ctx.toPromptContext()),
  });

  return null;
}
```

## Agent requests

```tsx
import { useAskable } from '@askable-ui/solid';

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

## Custom sources

Use `useAskableSource` to register any arbitrary data source:

```tsx
import { createSignal, createEffect } from 'solid-js';
import { useAskableSource } from '@askable-ui/solid';
import { createAskableStaticSource } from '@askable-ui/core';

export function CustomMetricsSource() {
  const [metrics, setMetrics] = createSignal({ revenue: 0, users: 0 });
  const source = createAskableStaticSource(() => metrics());
  const { notifyChanged } = useAskableSource('metrics', source);

  createEffect(() => {
    metrics(); // track
    notifyChanged();
  });

  return null;
}
```

## SSR

`useAskable` is safe to call during server rendering — on the server, `focus()` returns `null` and `promptContext()` returns `''`. All event listeners and DOM observation only run inside `createEffect`, which is browser-only. SolidStart apps with SSR work with any askable-ui hook without additional guards.
