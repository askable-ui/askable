# @askable-ui/react

React bindings for [askable](../../README.md) — give your UI components LLM awareness in one line.

## Install

```bash
npm install @askable-ui/react @askable-ui/core
```

## Quick Start

```tsx
import { Askable, useAskable } from '@askable-ui/react';

// Wrap any element to make it LLM-aware
function Dashboard() {
  return (
    <Askable meta={{ chart: 'revenue', period: 'Q3', value: '$2.3M' }}>
      <RevenueChart />
    </Askable>
  );
}

// Access focus context anywhere in your tree
function AIChatInput() {
  const { focus, promptContext } = useAskable();

  async function handleSubmit(question: string) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `UI context: ${promptContext}` },
          { role: 'user', content: question },
        ],
      }),
    });
    return res.json();
  }

  return (
    <div>
      {focus && <p>Asking about: {JSON.stringify(focus.meta)}</p>}
      <input onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e.currentTarget.value)} />
    </div>
  );
}
```

## API

### `<Askable meta={...} as="div">`

Renders any element (default: `div`) with a `data-askable` attribute. The `meta` prop accepts an object or string.

```tsx
<Askable meta={{ widget: 'churn-rate', value: '4.2%' }} as="section">
  <ChurnChart />
</Askable>

<Askable meta="main navigation" as="nav">
  <NavLinks />
</Askable>
```

**Props:**
- `meta` — structured metadata attached to the element (`Record<string, unknown> | string`)
- `as` — HTML tag to render (default: `"div"`)
- All other props are forwarded to the underlying element

### `useAskable(options?)`

Returns reactive focus state from the shared global `AskableContext`.

```ts
const { focus, promptContext, ctx } = useAskable();

// Restrict which interactions trigger a context update
const { focus, promptContext } = useAskable({ events: ['click'] });
const { focus, promptContext } = useAskable({ events: ['click', 'focus'] });
```

**Options:**
- `events?: AskableEvent[]` — trigger events: `'click'`, `'hover'`, `'focus'`. Defaults to all three.

**Returns:**
- `focus: AskableFocus | null` — current focus state
- `promptContext: string` — natural language string ready to inject into LLM prompts
- `ctx: AskableContext` — the underlying context instance (e.g. `ctx.select(el)`)

The hook manages a shared singleton context, so multiple calls across your app share the same observer. The context is automatically destroyed when the last consumer unmounts.

### "Ask AI" button pattern

Use `ctx.select()` to set context explicitly when a user clicks a button, instead of relying on hover or focus:

```tsx
function RevenueCard({ data }) {
  const { ctx } = useAskable();
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <Askable meta={data} ref={cardRef}>
      <RevenueChart data={data} />
      <button onClick={() => { ctx.select(cardRef.current!); openChat(); }}>
        Ask AI ✦
      </button>
    </Askable>
  );
}
```

## License

MIT
