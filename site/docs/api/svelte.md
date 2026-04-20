# @askable-ui/svelte

Svelte 4 bindings for askable-ui.

## Install

```bash
npm install @askable-ui/svelte @askable-ui/core
```

---

## `<Askable>`

Renders a wrapper element with `data-askable` managed reactively.

```svelte
<script>
  import Askable from '@askable-ui/svelte/Askable.svelte';
</script>

<Askable meta={{ metric: 'revenue', delta: '-12%' }}>
  <RevenueChart />
</Askable>

<Askable meta={{ metric: 'revenue' }} scope="analytics">
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

## `createAskableStore(options?)`

Factory that returns Svelte stores backed by an `AskableContext`. SSR-safe — `observe()` is guarded and only runs in the browser.

```ts
import { createAskableStore } from '@askable-ui/svelte';

const { focus, promptContext, ctx, destroy } = createAskableStore();
```

Always call `destroy()` in `onDestroy`:

```ts
import { onDestroy } from 'svelte';
const { destroy } = createAskableStore();
onDestroy(destroy);
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `events` | `AskableEvent[]` | Trigger events. Default: `['click', 'hover', 'focus']` |

**Returns:**

| Value | Type | Description |
|---|---|---|
| `focus` | `Readable<AskableFocus \| null>` | Reactive focus store |
| `promptContext` | `Readable<string>` | Reactive prompt-ready context store |
| `ctx` | `AskableContext` | Full context instance |
| `destroy` | `() => void` | Tears down the context |

**Examples:**

```ts
// Subscribe with $ auto-subscription in Svelte
$: console.log($focus?.meta);
$: console.log($promptContext);

// Click-only
const store = createAskableStore({ events: ['click'] });
```

### Inspector

Svelte can mount the inspector through `createAskableStore({ inspector: ... })`.

```ts
import { createAskableStore } from '@askable-ui/svelte';

const askable = createAskableStore({
  events: ['click'],
  inspector: {
    position: 'bottom-left',
  },
});
```

Because `createAskableStore()` creates a private context by default, the inspector automatically follows that store's context. If you want multiple components or stores to share one inspector/context, pass the same explicit `ctx` to each store:

```ts
import { createAskableContext } from '@askable-ui/core';

const sharedCtx = createAskableContext();
sharedCtx.observe(document, { events: ['hover'] });

const chartStore = createAskableStore({ ctx: sharedCtx, inspector: true });
const chatStore = createAskableStore({ ctx: sharedCtx });
```

Remember to call `destroy()` so the inspector panel is removed when the component/store is torn down.

### Shared vs private/custom contexts

Svelte differs from the React/Vue adapters: `createAskableStore()` creates a **private** `AskableContext` per store by default.

- **Private default** — every `createAskableStore()` call creates its own context and observer lifecycle.
- **Custom provided context** — pass `ctx` when multiple components/stores should share one context.
- **Per-surface isolation** — create separate stores or separate explicit contexts when different panels should not share focus/history.

That means if two components both call `createAskableStore()` with no `ctx`, they will not automatically share focus.

```ts
import { createAskableContext } from '@askable-ui/core';
import { createAskableStore } from '@askable-ui/svelte';

// Private stores: isolated from each other
const left = createAskableStore({ events: ['click'] });
const right = createAskableStore({ events: ['click'] });

// Shared explicit context across stores/components
const sharedCtx = createAskableContext();
sharedCtx.observe(document, { events: ['hover'] });

const chartStore = createAskableStore({ ctx: sharedCtx });
const chatStore = createAskableStore({ ctx: sharedCtx });
```

Use the private default for isolated widgets. Pass a shared `ctx` when multiple Svelte components need to agree on one Askable focus/history stream.
