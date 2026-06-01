# @askable-ui/react

React bindings for [askable](../../README.md) — give your UI components LLM awareness in one line.

## Install

```bash
npm install @askable-ui/react @askable-ui/core
```

## Quick Start

```tsx
import { Askable, useAskable, useAskableRegionCapture } from '@askable-ui/react';

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
  const { focus, promptContext, ctx } = useAskable();
  const capture = useAskableRegionCapture({
    ctx,
    onCapture: (packet) => sendToAgent(packet),
  });

  async function handleSubmit(question: string) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify(await ctx.toAgentRequest(question, {
        history: 3,
        packet: true,
      })),
    });
    return res.json();
  }

  return (
    <div>
      <button onClick={() => capture.start({ shape: 'circle' })}>
        Circle context
      </button>
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
Set `sourcePreview` when the dev panel should resolve registered source data in
the prompt preview and Copy output.

```tsx
function DevInspector() {
  useAskable({ events: ['click'] });

  return process.env.NODE_ENV === 'development'
    ? <AskableInspector events={['click']} position="bottom-left" sourcePreview />
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
  - `ctx.toPromptContextAsync(options?)` — include async app-owned sources
  - `ctx.toAgentRequest(question, options?)` — package a user question with prompt context, focus, and an optional Context packet
  - `ctx.subscribeAsync(callback, options?)` — stream source-backed context updates with stale result protection
  - `ctx.serializeFocus(options?)` — structured `AskableSerializedFocus` object
  - `ctx.toContextPacket()` — structured Context packet for agents and MCP bridges
- `useAskableSource()` — lifecycle-managed app-owned source registration
- `useAskableRegionCapture()` — explicit region/circle/lasso capture for visual page selection
- `useAskableTextSelectionCapture()` — explicit highlighted text capture for page copy selection

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

### App-owned sources

Use `useAskableSource()` when the assistant needs data that is not fully
rendered in the DOM: paginated tables, virtualized lists, documents, charts,
maps, calendars, canvases, or custom product state. The hook registers the
source after mount, keeps the latest resolver implementation current, and
unregisters automatically on unmount.

```tsx
import { useEffect } from 'react';
import { useAskableSource } from '@askable-ui/react';

function AccountsSource({ table, filters, sort }) {
  const accounts = useAskableSource('accounts', {
    kind: 'collection',
    describe: 'Customer accounts matching the active filters',
    getState: () => ({
      filters,
      sort,
      page: table.getState().pagination.pageIndex + 1,
      pageSize: table.getState().pagination.pageSize,
      totalCount: table.options.meta?.totalCount,
    }),
    resolve: async ({ mode, maxItems }) => {
      if (mode === 'visible') return table.getRowModel().rows.map((row) => row.original);
      return summarizeAccounts({ filters, sort, maxItems });
    },
    sanitize: (source) => ({
      ...source,
      data: redactAccountFields(source.data),
    }),
  });

  async function askAboutAccounts(question: string) {
    const promptContext = await accounts.toPromptContext({
      source: { mode: 'summary', maxItems: 20, timeoutMs: 750 },
      sourceErrorMode: 'include',
    });

    return sendToAgent({ question, promptContext });
  }

  useEffect(() => {
    return table.onStateChange(() => {
      accounts.notifyChanged();
    });
  }, [accounts.notifyChanged, table]);

  return null;
}
```

Use `ctx.toPromptContext()` for synchronous focus-only prompts. Use
`toPromptContextAsync()` or the hook's `toPromptContext()` helper when the
assistant should include resolver-backed application data.
Call `notifyChanged()` when source data changes without a DOM focus change,
such as pagination, filters, selected rows, or query-cache updates. Async
subscribers created with `ctx.subscribeAsync()` re-resolve matching sources.

### Region, circle, and lasso capture

Use `useAskableRegionCapture()` when a user should select an area of the page
and send that geometry as structured context.

```tsx
import { useAskable, useAskableRegionCapture } from '@askable-ui/react';

function RegionTools() {
  const { ctx } = useAskable({ viewport: true });
  const capture = useAskableRegionCapture({
    ctx,
    includeViewport: true,
    theme: {
      lassoStrokeWidth: 4,
      lassoGlowRadius: 12,
    },
    onCapture(packet) {
      sendToAgent(packet);
    },
  });

  return (
    <>
      <button onClick={() => capture.start({ shape: 'region' })}>
        Select region
      </button>
      <button onClick={() => capture.start({ shape: 'circle' })}>
        Circle area
      </button>
      <button onClick={() => capture.start({ shape: 'lasso' })}>
        Lasso area
      </button>
      {capture.active && <button onClick={capture.cancel}>Cancel</button>}
    </>
  );
}
```

The lasso overlay ships with the core `ASKABLE_REGION_CAPTURE_THEME`. Pass
`theme` through `useAskableRegionCapture()` to override the overlay,
region/circle fill, or lasso gradient for your app.

Use `once: false` when the capture control should stay active for repeated
region, circle, or lasso selections. The hook keeps `active` true until
`cancel()` or `destroy()` runs.

### Text selection capture

Use `useAskableTextSelectionCapture()` when a user highlights text and sends
that exact selection to an agent.

```tsx
import { useAskableTextSelectionCapture } from '@askable-ui/react';

function SelectionTools() {
  const selection = useAskableTextSelectionCapture({
    includeViewport: true,
    intent: 'answer using the highlighted text',
    onCapture(packet) {
      sendToAgent(packet);
    },
  });

  return (
    <>
      <button onClick={() => selection.start()}>Watch selection</button>
      <button onClick={() => selection.captureNow()}>Send selected text</button>
      {selection.active && <button onClick={selection.cancel}>Cancel</button>}
    </>
  );
}
```

## License

MIT
