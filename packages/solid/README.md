# @askable-ui/solid

Solid.js bindings for [askable](https://github.com/askable-ui/askable) — give your UI elements LLM awareness with one attribute.

## Install

```bash
npm install @askable-ui/solid @askable-ui/core
```

## Quick start

```tsx
import { Askable, useAskable } from '@askable-ui/solid';

function Dashboard() {
  const { focus, promptContext, ctx } = useAskable();

  return (
    <div>
      <Askable meta={{ widget: 'revenue-chart', period: 'Q3', value: '$2.3M' }}>
        <h2>Q3 Revenue: $2.3M</h2>
        <p>Down 12% month-over-month</p>
      </Askable>

      <button onClick={() => sendToLLM(promptContext())}>
        Ask AI
      </button>

      <p>Focus: {focus() ? focus()!.meta.toString() : 'none'}</p>
    </div>
  );
}
```

## API

### `useAskable(options?)`

A Solid primitive that tracks which `[data-askable]` element the user has interacted with.

```ts
const { focus, promptContext, ctx } = useAskable({
  events?: AskableEvent[];   // 'click' | 'hover' | 'focus' — defaults to all
  ctx?: AskableContext;      // provide your own context (e.g. from AskableProvider)
});
```

Returns:

| Property | Type | Description |
|---|---|---|
| `focus` | `() => AskableFocus \| null` | Reactive accessor for the currently focused element |
| `promptContext` | `() => string` | Reactive accessor for the serialized prompt string |
| `ctx` | `AskableContext` | The underlying context instance |

> **Note:** `focus` and `promptContext` are Solid **signals/memos** — call them as functions (`focus()`, `promptContext()`) in JSX and reactive contexts.

### `<Askable>`

Wraps any element with a `data-askable` attribute.

```tsx
<Askable
  meta={{ widget: 'chart', metric: 'revenue' }}
  as="section"           // defaults to "div"
  class="my-card"        // extra props forwarded to the element
>
  children
</Askable>
```

| Prop | Type | Description |
|---|---|---|
| `meta` | `Record<string, unknown> \| string` | Metadata serialized as `data-askable` |
| `as` | `ValidComponent` | Element or component to render. Defaults to `"div"` |
| `children` | `JSX.Element` | Child content |

## SSR

`useAskable` is SSR-safe — it checks for `document` before calling `observe` and falls back gracefully in Node environments.

## License

MIT
