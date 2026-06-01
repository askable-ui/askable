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

<input data-askable='{"field":"email","required":true}' data-askable-scope="form-helper" placeholder="Email address" />
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
const formPrompt = ctx.toPromptContext({ scope: 'form-helper' });
// e.g. "User is focused on: — action: submit, form: checkout — value "Complete Purchase""

// Clean up when done
ctx.destroy();
```

## Region, Circle, and Lasso Capture

Use `createAskableRegionCapture()` when the user should draw a page region,
circle an area, or lasso a freehand shape and send it as structured context.

```ts
import {
  ASKABLE_REGION_CAPTURE_THEME,
  createAskableContext,
  createAskableRegionCapture,
} from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const capture = createAskableRegionCapture(ctx, {
  shape: 'lasso',
  intent: 'explain this selected area',
  includeViewport: true,
  theme: {
    ...ASKABLE_REGION_CAPTURE_THEME,
    lassoStrokeWidth: 4,
    lassoGlowRadius: 12,
  },
  onCapture(packet) {
    sendToAgent(packet);
  },
});

capture.start();
```

The packet uses `capture.mode` of `region`, `circle`, or `lasso`, marks consent
as explicit, and includes the selected geometry in `target.bounds`. Lasso
captures also include `target.metadata.points` for the freehand path.
The built-in lasso overlay uses `ASKABLE_REGION_CAPTURE_THEME` by default; pass
`theme` to override any overlay, selection, or lasso style for your app.
Set `once: false` to keep the overlay mounted for repeated captures. The handle
reports active until `cancel()` or `destroy()` runs.

## Text Selection Capture

Use `createAskableTextSelectionCapture()` when the user should highlight page
text and send that exact selected range as structured context.

```ts
import { createAskableContext, createAskableTextSelectionCapture } from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const selection = createAskableTextSelectionCapture(ctx, {
  intent: 'answer using this selected text',
  includeViewport: true,
  onCapture(packet) {
    sendToAgent(packet);
  },
});

selection.start();
```

The packet uses `capture.mode` of `text-selection`, marks consent as explicit,
and includes the highlighted copy in `target.text`. Call `captureNow()` for
button-driven flows where selection should be read on demand.

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

#### `toPromptContext(options?: AskablePromptContextOptions): string`

Serializes the current focus state into a prompt-ready string. Returns `'No UI element is currently focused.'` (or `'null'` in JSON format) when nothing is focused.

```ts
// With no focus:
ctx.toPromptContext();
// → "No UI element is currently focused."

// Natural language (default):
// <button data-askable='{"action":"delete","target":"account"}'>Delete Account</button>
ctx.toPromptContext();
// → "User is focused on: — action: delete, target: account — value "Delete Account""

// JSON format:
ctx.toPromptContext({ format: 'json' });
// → '{"meta":{"action":"delete","target":"account"},"text":"Delete Account","timestamp":1712345678}'

// Custom prefix and label:
ctx.toPromptContext({ prefix: 'Active element:', textLabel: 'label' });
// → "Active element: — action: delete, target: account — label "Delete Account""

// Omit element text:
ctx.toPromptContext({ includeText: false });

// Truncate text to 100 chars:
ctx.toPromptContext({ maxTextLength: 100 });

// Exclude specific meta keys:
ctx.toPromptContext({ excludeKeys: ['_internal', 'debug'] });

// Prioritize key order:
ctx.toPromptContext({ keyOrder: ['action', 'target'] });

// Token budget — truncates output to ~50 tokens (4 chars/token estimate):
ctx.toPromptContext({ maxTokens: 50 });
// If output exceeds ~200 chars: "User is focused on: — ... [truncated]"
```

##### `AskablePromptContextOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `format` | `'natural' \| 'json'` | `'natural'` | Output format |
| `includeText` | `boolean` | `true` | Include element text content |
| `maxTextLength` | `number` | — | Truncate text to this many characters |
| `excludeKeys` | `string[]` | — | Omit these keys from object meta |
| `keyOrder` | `string[]` | — | Promote these keys to the front |
| `prefix` | `string` | `'User is focused on:'` | Prefix in natural format |
| `textLabel` | `string` | `'value'` | Label for text field in natural format |
| `maxTokens` | `number` | — | Approximate token budget. Uses a 4 chars/token estimate. Truncates output and appends `[truncated]` if exceeded. |

#### `registerSource(id, source)`

Register app-owned context that is not fully represented in the DOM: paginated
tables, virtualized lists, documents, maps, charts, calendars, canvases, file
trees, or custom product state.

```ts
import { createAskableCollectionSource, createAskableSource } from '@askable-ui/core';

const accountsSource = ctx.registerSource('accounts', createAskableCollectionSource({
  describe: 'Customer accounts matching the active filters',
  getState: () => ({ filters, sort, page, pageSize, totalCount }),
  getVisibleItems: () => table.getVisibleRows(),
  getSelectedItems: ({ selection }) => getAccountsByIds(selection),
  getItems: () => accountStore.getAllMatching({ filters, sort }),
  getSummary: ({ maxItems }) => summarizeAccounts({ filters, sort, maxItems }),
  maxItems: 50,
  sanitizeItem: redactAccountFields,
  sanitize: (source) => ({
    ...source,
    state: redactFilterState(source.state),
  }),
}));

ctx.registerSource('active-chart', createAskableSource({
  kind: 'chart',
  describe: 'Revenue chart',
  state: () => ({ range, segment }),
  modes: {
    summary: () => chart.summary(),
    selected: ({ selection }) => chart.pointsForSelection(selection),
    all: ({ maxItems }) => chart.series().slice(0, maxItems),
  },
  data: ({ mode }) => chart.export({ mode }),
}));

const prompt = await ctx.toPromptContextAsync({
  sources: [{ id: 'accounts', mode: 'all', maxItems: 20, timeoutMs: 750 }],
  sourceErrorMode: 'include',
});

table.onStateChange(() => {
  accountsSource.notifyChanged();
});
```

Source resolvers let Askable capture what the user meant while your app supplies
what it knows. Use `createAskableSource()` for arbitrary documents, charts,
maps, canvases, and product state. Its `modes` map is a concise way to expose
named slices such as `summary`, `selected`, `all`, or app-defined modes, while
`data` remains the fallback for modes you do not list. Use
`createAskableCollectionSource()` when a list, grid, table, board, or search
result has more data than the DOM currently renders. Failed or timed-out
sources are represented with a safe unavailable marker by default; use
`sourceErrorMode: 'omit'` or `'throw'` for stricter runtimes.

Call `handle.notifyChanged()` or `ctx.notifySourceChanged('accounts')` when
filters, pagination, query data, or selected records change without a DOM focus
change. Async subscribers re-resolve matching sources automatically. Stale
handles from unmounted or replaced components cannot unregister or notify a
newer source with the same id.

Use `ctx.hasSource(id)` and `ctx.listSources()` to drive source pickers,
diagnostics, or chat controls without resolving source data. `listSources()`
returns each source id, optional kind, registration time, and last update time.
Use `ctx.resolveSources()` when a chat endpoint, MCP bridge, or debug surface
needs structured source objects instead of prompt text. It resolves all
registered sources by default, or a selected subset when `sources` is passed.

```ts
const sources = await ctx.resolveSources({
  sources: [{ id: 'accounts', mode: 'all', maxItems: 20 }],
  sourceErrorMode: 'include',
});
```

#### `toHistoryContext(limit?: number, options?: AskablePromptContextOptions): string`

Serializes the focus history (newest first) into a prompt-ready string with numbered entries. Accepts the same `AskablePromptContextOptions` as `toPromptContext()`, including `maxTokens`. Returns `'No interaction history.'` when no interactions have occurred.

```ts
// After a few interactions:
ctx.toHistoryContext();
// → "[1] User is focused on: — action: delete, target: account — value "Delete Account"
//    [2] User is focused on: — page: settings — value "Account Settings"
//    [3] User is focused on: — page: dashboard — value "Dashboard""

// Last 3 interactions only:
ctx.toHistoryContext(3);

// With serialization options:
ctx.toHistoryContext(5, { includeText: false, excludeKeys: ['_id'] });

// With a token budget:
ctx.toHistoryContext(10, { maxTokens: 200 });
```

#### `serializeFocus(options?: AskablePromptContextOptions): AskableSerializedFocus | null`

Returns the current focus as a structured `AskableSerializedFocus` object, or `null` if nothing is focused. Useful when you want to process or store the data before formatting it as a string.

```ts
const data = ctx.serializeFocus();
// → { meta: { action: 'delete', target: 'account' }, text: 'Delete Account', timestamp: 1712345678 }

// With options (same as toPromptContext):
ctx.serializeFocus({ includeText: false, excludeKeys: ['debug'] });

// Use the structured data:
if (data) {
  await db.insertFocusEvent(data.meta, data.timestamp);
}
```

#### `getHistory(limit?: number): AskableFocus[]`

Returns the focus history, newest first. Optional `limit` caps the number of results. History is capped at 50 entries.

```ts
const history = ctx.getHistory();     // all entries, newest first
const recent = ctx.getHistory(5);     // last 5 interactions
```

#### `clear(): void`

Resets the current focus to `null` and emits a `'clear'` event.

```ts
ctx.on('clear', () => console.log('Focus cleared'));
ctx.clear();
// → focus is null, 'clear' event fires
```

#### `subscribe(callback, options?): () => void`

Subscribe to serialized context updates for streaming LLM integrations. The callback receives the latest `ctx.toContext()` string plus the current `AskableFocus | null`. Returns an unsubscribe function.

```ts
const unsubscribe = ctx.subscribe((context, focus) => {
  streamTransport.send({
    type: 'ui-context',
    context,
    focusedMeta: focus?.meta ?? null,
  });
}, {
  history: 3,
  debounce: 75,
});

// later
unsubscribe();
```

Use `debounce` to coalesce rapid focus changes while a response is streaming.

#### `toAgentRequest(question, options?): Promise<AskableAgentRequest>`

Package a user question with source-backed context for chat and agent
transports. The returned object is JSON-ready and includes the question,
`toContextAsync()` output, serialized focus, optional Context packet, timestamp,
and optional app metadata.

```ts
const request = await ctx.toAgentRequest('Why did this metric change?', {
  requestId: crypto.randomUUID(),
  history: 3,
  sources: [{ id: 'accounts', mode: 'summary', timeoutMs: 750 }],
  packet: true,
  metadata: { route: '/dashboard' },
});

await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
});
```

For "select first, then ask" flows, pass an existing `WebContextPacket` from a
region, circle, lasso, or text selection capture as `packet`. Askable attaches
that exact packet to the request while still generating the prompt-ready context
string from the current focus and registered sources.

#### `subscribeAsync(callback, options?): () => void`

Subscribe to source-backed context updates. The callback receives
`ctx.toContextAsync()` output, so registered app sources can be included in live
chat or streaming transports.

```ts
const unsubscribe = ctx.subscribeAsync(async (context, focus) => {
  await streamTransport.send({
    type: 'ui-context',
    context,
    focusedMeta: focus?.meta ?? null,
  });
}, {
  history: 3,
  sources: [{ id: 'accounts', mode: 'summary', timeoutMs: 750 }],
  debounce: 100,
  onError(error) {
    reportContextError(error);
  },
});
```

Async subscriptions rerun when focus changes, clear is called, or a matching
source calls `notifyChanged()`. They ignore stale source results when a newer
focus or source update happens before a previous resolver finishes. Use
`emitInitial: true` to send the current context immediately after registration.

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
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify(await ctx.toAgentRequest(question, {
        history: 3,
        packet: true,
      })),
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
  AskableContext,             // Main context interface
  AskableFocus,               // Focus state: { meta, text, element, timestamp }
  AskableSerializedFocus,     // Serialized focus: { meta, text?, timestamp }
  AskablePromptContextOptions, // Options for toPromptContext / toHistoryContext
  AskablePromptFormat,        // 'natural' | 'json'
  AskableEvent,               // Trigger type: 'click' | 'hover' | 'focus'
  AskableObserveOptions,      // Options for observe(): { events?, hoverDebounce?, hoverThrottle? }
  AskableEventMap,            // Map of event names to payload types
  AskableEventName,           // 'focus' | 'clear'
  AskableEventHandler,        // Generic handler type
} from '@askable-ui/core';
```

### `AskableSerializedFocus`

```ts
interface AskableSerializedFocus {
  meta: Record<string, unknown> | string;
  text?: string;    // omitted when includeText: false or text is empty
  timestamp: number;
}
```

## License

MIT
