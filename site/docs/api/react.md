# @askable-ui/react

React bindings for askable-ui. Requires React 17+.

## Install

```bash
npm install @askable-ui/react @askable-ui/core
```

---

## `<Askable>`

Renders a wrapper element with `data-askable` managed reactively from the `meta` prop.

```tsx
import { Askable } from '@askable-ui/react';

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
| `as` | `keyof JSX.IntrinsicElements` | `"div"` | HTML element to render |
| `ref` | `Ref<HTMLElement>` | — | Forwarded to the underlying element |
| ...rest | | | All other props forwarded to the element |

---

## `useAskable(options?)`

Hook that provides reactive access to a shared `AskableContext` for the requested `events` configuration. Observation starts after mount; additional consumers with the same `events` reuse the existing observer instead of re-observing the document. Differing `events` configurations get isolated shared contexts, each destroyed when its last consumer unmounts. Pass `name` to scope that shared lifecycle to a specific UI region (for example `table` vs `chart`).

```ts
import { useAskable } from '@askable-ui/react';

const { focus, promptContext, ctx } = useAskable();
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `name` | `string` | Optional shared context name for region-scoped context reuse |
| `viewport` | `boolean` | Enable viewport-aware context tracking for this hook's context |
| `events` | `AskableEvent[]` | Trigger events. Default: `['click', 'hover', 'focus']` |
| `ctx` | `AskableContext` | Provide a custom context instead of the shared singleton |

**Returns:**

| Value | Type | Description |
|---|---|---|
| `focus` | `AskableFocus \| null` | Current focused element data |
| `promptContext` | `string` | Natural-language context string |
| `ctx` | `AskableContext` | Full context instance — `select()`, `clear()`, `getHistory()`, `toHistoryContext()`, etc. |

**Examples:**

```ts
// Restrict trigger events
const { focus } = useAskable({ events: ['click'] });

// Scoped context (multiple independent AI surfaces)
import { createAskableContext } from '@askable-ui/core';
const myCtx = createAskableContext();
myCtx.observe(panelEl);

const { focus } = useAskable({ ctx: myCtx });
```
