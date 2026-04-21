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

<Askable meta={{ widget: 'revenue-chart' }} scope="analytics">
  <RevenueChart />
</Askable>

<Askable meta={{ widget: 'pipeline-chart' }} events={['hover']}>
  <PipelineChart />
</Askable>

<Askable meta="main navigation" as="nav">
  <NavLinks />
</Askable>
```

**Props:**
- `meta` — structured metadata attached to the element (`Record<string, unknown> | string`)
- `scope` — optional category written to `data-askable-scope` for scoped prompt/history queries
- `events` — optional per-component activation override (`AskableEvent[] | 'manual'`)
- `as` — HTML tag to render (default: `"div"`)
- All other props are forwarded to the underlying element

Use `events` when one annotated component should be hover-only, click-only, or fully manual within the same page/context.

```tsx
function MixedDashboard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const { ctx } = useAskable();

  return (
    <>
      <Askable meta={{ widget: 'pipeline' }} events={['hover']}>
        <PipelineCard />
      </Askable>

      <Askable meta={{ widget: 'revenue' }} events={['click']}>
        <RevenueCard />
      </Askable>

      <Askable ref={cardRef} meta={{ widget: 'account-summary' }} events="manual">
        <AccountSummary />
        <button onClick={() => cardRef.current && ctx.select(cardRef.current)}>
          Ask AI
        </button>
      </Askable>
    </>
  );
}
```

### `AskableInspector(props?)`

Declarative React wrapper around the core inspector.

```tsx
import { AskableInspector } from '@askable-ui/react';

<AskableInspector events={['click']} />
```

Pass the same `events`, `name`, `viewport`, or `ctx` that your React app uses for `useAskable()` when the inspector should follow the same context.

```tsx
function DevInspector() {
  useAskable({ events: ['click'] });

  return process.env.NODE_ENV === 'development'
    ? <AskableInspector events={['click']} position="bottom-left" />
    : null;
}
```

### `useAskable(options?)`

Returns reactive focus state from the shared global `AskableContext`.

```ts
const { focus, promptContext, ctx } = useAskable();

// Restrict which interactions trigger a context update
const { focus: clickFocus } = useAskable({ events: ['click'] });
const { focus: hoverFocus } = useAskable({ events: ['hover'] });
const { focus: focusOnly } = useAskable({ events: ['focus'] });
```

**Options:**
- `name?: string` — optional shared context name for region-specific context reuse
- `viewport?: boolean` — enable viewport-aware context tracking for this hook's context
- `events?: AskableEvent[]` — trigger events: `'click'`, `'hover'`, `'focus'`. Defaults to all three.
- `ctx?: AskableContext` — provide a custom context instead of the shared singleton

**Returns:**
- `focus: AskableFocus | null` — current focus state
- `promptContext: string` — natural language string ready to inject into LLM prompts
- `ctx: AskableContext` — the underlying context instance for advanced use:
  - `ctx.select(el)` — programmatically set focus ("Ask AI" button pattern)
  - `ctx.clear()` — reset focus to null
  - `ctx.getHistory(limit?)` — focus history, newest first
  - `ctx.toHistoryContext(limit?, options?)` — history as a prompt-ready string
  - `ctx.toPromptContext(options?)` — full serialization options (format, maxTokens, excludeKeys, …)
  - `ctx.serializeFocus(options?)` — structured `AskableSerializedFocus` object

The hook manages a shared singleton context per `name + events + viewport` configuration. Multiple `useAskable()` consumers with the same shared configuration reuse one observer lifecycle, while differing configurations get isolated shared contexts of their own. Each shared context is automatically destroyed when its last consumer unmounts.

If you need isolation, create your own context and pass it through `ctx`:

```tsx
const panelCtx = createAskableContext();
panelCtx.observe(panelEl, { events: ['hover'] });

function AnalyticsPanelChat() {
  const { promptContext } = useAskable({ ctx: panelCtx });
  return <textarea defaultValue={promptContext} />;
}
```


### SSR note

`useAskable()` is safe to call in SSR frameworks such as Next.js. Observation starts on the client after mount, not during server render.

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
