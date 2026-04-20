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
