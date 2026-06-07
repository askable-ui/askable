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

- `scope` is optional and writes `data-askable-scope` for scoped prompt/history queries.

### `useAskable(options?)`

Returns reactive focus state from the shared context for the requested `events` configuration.

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
- `ctx.toPromptContextAsync(options?)` — include async app-owned sources
- `ctx.serializeFocus(options?)` — structured `AskableSerializedFocus` object
- `useAskableSource()` — lifecycle-managed app-owned source registration

The composable manages a shared singleton context per `events` configuration. Multiple `useAskable()` consumers with the same `events` reuse one observer lifecycle, while differing `events` configurations get isolated shared contexts of their own. Each shared context is automatically destroyed when its last consumer unmounts.

### `useAskableSource(options?)`

Use `useAskableSource()` when the assistant needs data that is not fully
rendered in the DOM: paginated tables, virtualized lists, documents, charts,
maps, calendars, canvases, or custom product state. The composable registers the
source during setup, keeps reactive values current through your resolver
closures, and unregisters automatically on unmount.

```vue
<script setup lang="ts">
import { watch } from 'vue';
import { useAskableSource } from '@askable-ui/vue';

const accounts = useAskableSource('accounts', {
  kind: 'collection',
  describe: 'Customer accounts matching the active filters',
  getState: () => ({
    filters: filters.value,
    sort: sort.value,
    page: table.getState().pagination.pageIndex + 1,
    pageSize: table.getState().pagination.pageSize,
    totalCount: totalCount.value,
  }),
  resolve: async ({ mode, maxItems }) => {
    if (mode === 'visible') return table.getRowModel().rows.map((row) => row.original);
    return summarizeAccounts({ filters: filters.value, sort: sort.value, maxItems });
  },
  sanitize: (source) => ({
    ...source,
    data: redactAccountFields(source.data),
  }),
});

async function ask(question: string) {
  const promptContext = await accounts.toPromptContext({
    source: { mode: 'summary', maxItems: 20, timeoutMs: 750 },
    sourceErrorMode: 'include',
  });

  return sendToAgent({ question, promptContext });
}

watch([filters, sort, totalCount], () => {
  accounts.notifyChanged();
});
</script>
```

Call `notifyChanged()` when source data changes without a DOM focus change,
such as pagination, filters, selected rows, or query-cache updates. Async
subscribers created with `ctx.subscribeAsync()` re-resolve matching sources.

### `useAskableRegionCapture(options?)`

Starts an explicit region, circle, or lasso selection overlay and emits a structured Context packet through the same `AskableContext`.

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useAskableRegionCapture } from '@askable-ui/vue';

const capture = useAskableRegionCapture({
  includeViewport: true,
  source: { app: 'analytics-dashboard' },
  intent: 'answer with this selected area as context',
});

const selectedContext = computed(() =>
  capture.lastPacket.value ? JSON.stringify(capture.lastPacket.value, null, 2) : ''
);
</script>

<template>
  <button @click="capture.start()">Select region</button>
  <button @click="capture.start({ shape: 'circle' })">Circle area</button>
  <button @click="capture.start({ shape: 'lasso' })">Lasso area</button>
  <button v-if="capture.active.value" @click="capture.cancel()">Cancel</button>
  <pre v-if="selectedContext">{{ selectedContext }}</pre>
</template>
```

The result includes `active`, `lastPacket`, `lastSelection`, `start(overrides)`,
`cancel()`, `clearSelection()`, `getSelection()`, `destroy()`, `isActive()`,
and `ctx`. Use `getSelection()` to read the current pinned packet, selection
geometry, and affordance element.
Pass `once: false` when the capture control should stay active for repeated
region, circle, or lasso selections. The composable keeps `active` true until
`cancel()` or `destroy()` runs.

### `useAskableTextSelectionCapture(options?)`

Captures highlighted browser text and emits a structured Context packet through
the same `AskableContext`.

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useAskableTextSelectionCapture } from '@askable-ui/vue';

const selection = useAskableTextSelectionCapture({
  includeViewport: true,
  source: { app: 'analytics-dashboard' },
  intent: 'answer using the highlighted text',
});

const selectedContext = computed(() =>
  selection.lastPacket.value ? JSON.stringify(selection.lastPacket.value, null, 2) : ''
);
</script>

<template>
  <button @click="selection.start()">Watch selection</button>
  <button @click="selection.captureNow()">Send selected text</button>
  <button v-if="selection.active.value" @click="selection.cancel()">Cancel</button>
  <pre v-if="selectedContext">{{ selectedContext }}</pre>
</template>
```

The result includes `active`, `lastPacket`, `lastSelection`, `start(overrides)`,
`captureNow(overrides)`, `cancel()`, `clearSelection()`, `getSelection()`,
`destroy()`, `isActive()`, and `ctx`. Use `getSelection()` to read the current
pinned text packet, selected range metadata, and affordance element.

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
