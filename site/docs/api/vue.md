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

## `useAskable(options?)`

Composable that provides reactive access to the shared global `AskableContext`. Observation starts in `onMounted()`; context is destroyed when the last consumer unmounts.

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
