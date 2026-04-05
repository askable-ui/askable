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

<Askable meta="main navigation" as="nav">
  <NavLinks />
</Askable>
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `meta` | `Record<string, unknown> \| string` | — | Value for `data-askable` attribute |
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
