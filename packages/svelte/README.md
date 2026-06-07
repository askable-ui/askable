# @askable-ui/svelte

Svelte 4 bindings for [askable](../../README.md) — give your UI components LLM awareness in one line.

## Install

```bash
npm install @askable-ui/svelte @askable-ui/core
```

## Quick Start

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  const { focus, promptContext, destroy } = createAskableStore();
  onDestroy(destroy);

  async function ask(question: string) {
    return fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `UI context: ${$promptContext}` },
          { role: 'user', content: question },
        ],
      }),
    });
  }
</script>

<Askable meta={{ chart: 'revenue', period: 'Q3', value: '$128k' }} as="section">
  <RevenueChart />
</Askable>

{#if $focus}
  <p>Focused: {JSON.stringify($focus.meta)}</p>
{/if}
```

## API

### `<Askable meta={...} as="div">`

Renders any element (default: `div`) with a `data-askable` attribute. Accepts a `<slot />`.

- `scope` is optional and writes `data-askable-scope` for scoped prompt/history queries.

### `createAskableStore(options?)`

Returns Svelte stores backed by a core `AskableContext`.

```ts
const { focus, promptContext, ctx, destroy } = createAskableStore();
// focus: Readable<AskableFocus | null>
// promptContext: Readable<string>
// ctx: AskableContext

// Restrict which interactions trigger a context update
const { focus, promptContext, ctx, destroy } = createAskableStore({ events: ['click'] });
```

**Options:**
- `events?: AskableEvent[]` — trigger events: `'click'`, `'hover'`, `'focus'`. Defaults to all three.

**`ctx` advanced methods** (via `@askable-ui/core`):
- `ctx.select(el)` — programmatically set focus ("Ask AI" button pattern)
- `ctx.clear()` — reset focus to null and emit `'clear'` event
- `ctx.getHistory(limit?)` — focus history, newest first
- `ctx.toHistoryContext(limit?, options?)` — history as a prompt-ready string
- `ctx.toPromptContext(options?)` — full serialization options (format, maxTokens, excludeKeys, …)
- `ctx.toPromptContextAsync(options?)` — include async app-owned sources
- `ctx.serializeFocus(options?)` — structured `AskableSerializedFocus` object

### `createAskableSourceStore(options?)`

Use `createAskableSourceStore()` when the assistant needs data that is not fully
rendered in the DOM: paginated tables, virtualized lists, documents, charts,
maps, calendars, canvases, or custom product state. The store registers the
source immediately and unregisters it when `destroy()` is called.

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createAskableSourceStore } from '@askable-ui/svelte';

  const accounts = createAskableSourceStore('accounts', {
    kind: 'collection',
    describe: 'Customer accounts matching the active filters',
    getState: () => ({
      filters,
      sort,
      page: table.getState().pagination.pageIndex + 1,
      pageSize: table.getState().pagination.pageSize,
      totalCount,
    }),
    resolve: async ({ mode, maxItems }) => {
      if (mode === 'visible') return table.getRowModel().rows.map((row) => row.original);
      return summarizeAccounts({ filters, sort, maxItems });
    },
    sanitize: (source) => ({
      ...source,
      data: redactAccountFields(source.data),
    }),
  });

  onDestroy(accounts.destroy);

  async function ask(question: string) {
    const promptContext = await accounts.toPromptContext({
      source: { mode: 'summary', maxItems: 20, timeoutMs: 750 },
      sourceErrorMode: 'include',
    });

    return sendToAgent({ question, promptContext });
  }

  $: {
    filters;
    sort;
    totalCount;
    accounts.notifyChanged();
  }
</script>
```

Call `notifyChanged()` when source data changes without a DOM focus change,
such as pagination, filters, selected rows, or query-cache updates. Async
subscribers created with `ctx.subscribeAsync()` re-resolve matching sources.

### `createAskableRegionCaptureStore(options?)`

Starts an explicit region, circle, or lasso selection overlay and exposes the captured Context packet as Svelte stores.

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createAskableRegionCaptureStore } from '@askable-ui/svelte';

  const capture = createAskableRegionCaptureStore({
    includeViewport: true,
    source: { app: 'analytics-dashboard' },
    intent: 'answer with this selected area as context',
  });
  const { active, lastPacket } = capture;

  onDestroy(capture.destroy);
</script>

<button on:click={() => capture.start()}>Select region</button>
<button on:click={() => capture.start({ shape: 'circle' })}>Circle area</button>
<button on:click={() => capture.start({ shape: 'lasso' })}>Lasso area</button>
{#if $active}
  <button on:click={capture.cancel}>Cancel</button>
{/if}

{#if $lastPacket}
  <pre>{JSON.stringify($lastPacket, null, 2)}</pre>
{/if}
```

The store includes `active`, `lastPacket`, `lastSelection`, `start(overrides)`,
`cancel()`, `clearSelection()`, `getSelection()`, `destroy()`, `isActive()`,
and `ctx`. Use `getSelection()` to read the current pinned packet, selection
geometry, and affordance element.
Use `onSelectionChange(state)` to mirror pinned context into external composer
state.
Pass `once: false` when the capture control should stay active for repeated
region, circle, or lasso selections. The store keeps `active` true until
`cancel()` or `destroy()` runs.

### `createAskableTextSelectionCaptureStore(options?)`

Captures highlighted browser text and exposes the captured Context packet as
Svelte stores.

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createAskableTextSelectionCaptureStore } from '@askable-ui/svelte';

  const selection = createAskableTextSelectionCaptureStore({
    includeViewport: true,
    source: { app: 'analytics-dashboard' },
    intent: 'answer using the highlighted text',
  });
  const { active, lastPacket } = selection;

  onDestroy(selection.destroy);
</script>

<button on:click={() => selection.start()}>Watch selection</button>
<button on:click={() => selection.captureNow()}>Send selected text</button>
{#if $active}
  <button on:click={selection.cancel}>Cancel</button>
{/if}

{#if $lastPacket}
  <pre>{JSON.stringify($lastPacket, null, 2)}</pre>
{/if}
```

The store includes `active`, `lastPacket`, `lastSelection`, `start(overrides)`,
`captureNow(overrides)`, `cancel()`, `clearSelection()`, `getSelection()`,
`destroy()`, `isActive()`, and `ctx`. Use `getSelection()` to read the current
pinned text packet, selected range metadata, and affordance element.
Use `onSelectionChange(state)` to keep chat input state aligned with the pinned
text selection.

### "Ask AI" button pattern

Use `ctx.select()` to set context explicitly when a user clicks a button:

```svelte
<script lang="ts">
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  const { ctx, destroy } = createAskableStore();
  onDestroy(destroy);

  let cardEl: HTMLElement;
</script>

<Askable bind:el={cardEl} meta={data}>
  <RevenueChart {data} />
  <button on:click={() => { ctx.select(cardEl); openChat(); }}>
    Ask AI ✦
  </button>
</Askable>
```

## License

MIT


### SSR note

`createAskableStore()` is safe to create in SSR environments. Observation only starts when `document` exists in the browser.
