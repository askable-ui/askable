# @askable-ui/vue

Vue 3 bindings for askable-ui. Requires Vue 3.2+.

## Install

```bash
npm install @askable-ui/vue @askable-ui/core
```

---

## `<Askable>`

Renders a wrapper element with `data-askable` managed reactively from `:meta`.

```vue
<Askable :meta="{ metric: 'revenue', delta: '-12%' }">
  <RevenueChart />
</Askable>

<Askable :meta="{ metric: 'revenue' }" scope="analytics">
  <RevenueChart />
</Askable>

<Askable meta="main navigation" as="nav">
  <NavLinks />
</Askable>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `meta` | `Record<string, unknown> \| string` | — | Value for `data-askable` attribute |
| `scope` | `string` | — | Optional category written to `data-askable-scope` for scoped prompt/history queries |
| `as` | `string` | `"div"` | HTML element to render |

---

## `useAskable(options?)`

Composable that provides reactive access to a shared `AskableContext` for the requested `events` configuration. Observation starts in `onMounted()`; additional consumers with the same `events` reuse the existing observer instead of re-observing the document. Differing `events` configurations get isolated shared contexts, each destroyed when its last consumer unmounts. Pass `name` to scope that shared lifecycle to a specific UI region (for example `table` vs `chart`).

```ts
import { useAskable } from '@askable-ui/vue';

const { focus, promptContext, ctx } = useAskable();
// focus: Ref<AskableFocus | null>
// promptContext: ComputedRef<string>
// ctx: AskableContext
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `name` | `string` | Optional shared context name for region-scoped context reuse |
| `viewport` | `boolean` | Enable viewport-aware context tracking for this composable's context |
| `events` | `AskableEvent[]` | Trigger events. Default: `['click', 'hover', 'focus']` |

**Returns:**

| Value | Type | Description |
|---|---|---|
| `focus` | `Ref<AskableFocus \| null>` | Reactive current focus |
| `promptContext` | `ComputedRef<string>` | Reactive prompt-ready context string |
| `ctx` | `AskableContext` | Full context instance |

**Examples:**

```ts
// Click-only
const { focus } = useAskable({ events: ['click'] });

// Use in template
// promptContext.value in <script setup>
// {{ promptContext }} in template
```

### Inspector

Vue can mount the inspector through `useAskable({ inspector: ... })` so the panel follows the same composable-managed context.

```ts
const { focus } = useAskable({
  events: ['click'],
  inspector: {
    position: 'bottom-left',
  },
});
```

Use this in development only. If you need a custom context, create it yourself and pass `ctx`:

```ts
import { createAskableContext } from '@askable-ui/core';

const panelCtx = createAskableContext();
panelCtx.observe(panelEl, { events: ['hover'] });

const askable = useAskable({
  ctx: panelCtx,
  inspector: true,
});
```

When combining custom `events` with the inspector, prefer `useAskable({ inspector: true, events: [...] })` so the dev panel and your Vue UI share the same context.

### Shared vs private/custom contexts

Vue mirrors the React adapter's context model:

- **Default shared context** — `useAskable()` reuses one shared document observer for the same `events` + `viewport` configuration.
- **Named shared context** — `useAskable({ name: 'chart' })` reuses a separate shared context for one region or AI surface.
- **Private auto-created context** — passing context-creation options like `maxHistory`, `sanitizeMeta`, `sanitizeText`, or `textExtractor` without `name` or `ctx` creates a private context for that composable instance.
- **Custom provided context** — `useAskable({ ctx })` attaches to an explicitly created `AskableContext` that you observe/configure yourself.

Use the shared mode when multiple Vue components should agree on the same focus/history. Use a private or provided context when one panel needs isolation or a custom root.

```ts
// Shared chart/chat pair
const chart = useAskable({ name: 'chart', events: ['hover'] });
const chat = useAskable({ name: 'chart', events: ['hover'] });

// Private composable instance with sanitization
const privateAskable = useAskable({
  sanitizeText: (text) => text.trim(),
  maxHistory: 10,
});

// Explicit provided context
import { createAskableContext } from '@askable-ui/core';

const panelCtx = createAskableContext();
panelCtx.observe(panelEl, { events: ['click'] });

const panel = useAskable({ ctx: panelCtx });
```

---

## `useAskableSource(id, source, options?)`

Lifecycle-managed registration for app-owned context sources. Use this when the
assistant needs data that is not fully rendered in the DOM: paginated tables,
virtualized lists, documents, charts, maps, calendars, canvases, file trees, or
custom state.

The composable registers the source during setup, keeps reactive values current
through your resolver closures, and unregisters automatically on unmount.

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

**Options:**

| Option | Type | Description |
|---|---|---|
| `enabled` | `boolean` | Register while true. Defaults to `true` |
| `name` / `events` / `viewport` / `ctx` | same as `useAskable()` | Choose the context that owns the source |

**Returns:**

| Value | Type | Description |
|---|---|---|
| `ctx` | `AskableContext` | Context instance that owns the source |
| `sourceId` | `string` | Trimmed registered source id |
| `resolve(request?)` | `Promise<AskableResolvedContextSource>` | Resolve this source directly |
| `toPromptContext(options?)` | `Promise<string>` | Serialize focus plus this source |
| `notifyChanged()` | `() => void` | Re-resolve matching async subscribers after source data changes |
| `unregister()` | `() => void` | Manually unregister before unmount when needed |

---

## `useAskableRegionCapture(options?)`

Composable that starts an explicit region, circle, or lasso selection overlay and emits a structured Context packet through the same `AskableContext`.

```ts
import { useAskableRegionCapture } from '@askable-ui/vue';

const capture = useAskableRegionCapture({
  includeViewport: true,
  source: { app: 'dashboard' },
  intent: 'answer with this selected area as context',
});

capture.start();
capture.start({ shape: 'circle' });
capture.start({ shape: 'lasso' });
capture.cancel();
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `shape` | `'region' \| 'circle' \| 'lasso'` | Initial capture shape. Default: `'region'` |
| `includeViewport` | `boolean` | Include viewport metadata in the emitted Context packet |
| `source` | `WebContextSource` | App/page source metadata attached to the packet |
| `intent` | `string` | User intent attached to the capture |
| `ctx` | `AskableContext` | Optional context to share with other Vue consumers |
| `name` | `string` | Optional shared context name when `ctx` is not provided |
| `events` | `AskableEvent[]` | Observation events for the underlying `useAskable()` context |
| `onCapture` | `(packet, selection) => void` | Called after a region, circle, or lasso is accepted |
| `onSelectionChange` | `(state) => void` | Called when pinned selected context changes or is cleared |
| `onCancel` | `() => void` | Called after active capture is cancelled |

**Returns:**

| Value | Type | Description |
|---|---|---|
| `active` | `Ref<boolean>` | Whether the overlay is active |
| `lastPacket` | `ShallowRef<WebContextPacket \| null>` | Last captured Context packet |
| `lastSelection` | `ShallowRef<AskableRegionCaptureSelection \| null>` | Last raw region/circle/lasso selection geometry |
| `selectionState` | `ShallowRef<AskableRegionCaptureState \| null>` | Reactive pinned packet, selection, and selected-state affordance element for rendering confirmation UI |
| `start` | `(overrides?) => void` | Starts capture, optionally overriding options for one capture |
| `cancel` | `() => void` | Cancels the active overlay |
| `clearSelection` | `() => void` | Removes the current persisted selected-state UI |
| `getSelection` | `() => AskableRegionCaptureState \| null` | Reads the currently pinned packet, selection, and affordance element |
| `destroy` | `() => void` | Cancels capture and removes overlay listeners |
| `isActive` | `() => boolean` | Reads the current overlay state |
| `ctx` | `AskableContext` | Shared or provided context instance |

For persistent capture tools, pass `once: false`. The overlay and `active` ref
stay on after each accepted capture until the user cancels or the composable is
unmounted.

Use `selectionState` when a Vue component should visibly confirm selected
context or render an inline question input. It mirrors `getSelection()` and
updates when capture pins, clears, or dismisses selected context.

---

## `useAskableTextSelectionCapture(options?)`

Composable that captures highlighted browser text and emits a structured
Context packet through the same `AskableContext`.

```ts
import { useAskableTextSelectionCapture } from '@askable-ui/vue';

const selection = useAskableTextSelectionCapture({
  includeViewport: true,
  source: { app: 'dashboard' },
  intent: 'answer using this highlighted text',
});

selection.start();
selection.captureNow();
selection.cancel();
```

**Options:** `root`, `minLength`, `debounce`, `once`, `dedupe`, `source`,
`intent`, `ctx`, `name`, `events`, `onCapture`, `onSelectionChange`, and
`onCancel`.

**Returns:** `active`, `lastPacket`, `lastSelection`, `selectionState`,
`start(overrides?)`, `captureNow(overrides?)`, `cancel()`, `clearSelection()`,
`getSelection()`, `destroy()`, `isActive()`, and `ctx`.

Use `selectionState` for app-rendered selected-text confirmation and inline
chat inputs. It mirrors `getSelection()` and updates when text context is
pinned, cleared, dismissed, cancelled, or destroyed.
