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

<Askable meta={{ metric: 'revenue' }} scope="analytics">
  <RevenueChart />
</Askable>

<Askable meta={{ metric: 'pipeline' }} events={['hover']}>
  <PipelineChart />
</Askable>

<Askable meta={{ metric: 'revenue' }} events="manual">
  <RevenueCard />
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
| `events` | `AskableEvent[] \| 'manual'` | — | Optional per-component activation override. Use a subset like `['hover']`/`['click']` to narrow passive activation or `'manual'` to disable passive activation entirely |
| `as` | `keyof JSX.IntrinsicElements` | `"div"` | HTML element to render |
| `ref` | `Ref<HTMLElement>` | — | Forwarded to the underlying element |
| ...rest | | | All other props forwarded to the element |

Use `events` on `<Askable>` when one component should behave differently from the surrounding shared context. Typical patterns are hover-only cards, click-only cards, or fully manual cards that are activated through `ctx.select()`.

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

Declarative React wrapper around `createAskableInspector()`.

```tsx
import { AskableInspector } from '@askable-ui/react';

// Match a click-only shared React context
<AskableInspector events={['click']} />
```

**Props:**
- all core `AskableInspectorOptions` props such as `position`, `highlight`, `tools`, `promptOptions`, and `sourcePreview`
- `ctx?: AskableContext` — reuse an explicit context
- `name?: string` — match a named shared React context
- `events?: AskableEvent[]` — match a shared React event configuration
- `viewport?: boolean` — match a shared viewport-aware React context

When you are already using `useAskable({ events: [...] })`, pass the same `events` (or the same `ctx`) to `<AskableInspector />` so the dev panel tracks the same context instead of silently falling back to the default click/hover/focus observer.

```tsx
function DashboardDevTools() {
  useAskable({ events: ['click'] });

  return (
    <>
      {/* app UI */}
      {process.env.NODE_ENV === 'development' && (
        <AskableInspector events={['click']} position="bottom-left" />
      )}
    </>
  );
}
```

Set `sourcePreview` to include registered source data in the inspector preview
and Copy output:

```tsx
<AskableInspector
  ctx={ctx}
  sourcePreview={{ sources: [{ id: 'accounts', mode: 'summary' }] }}
/>
```

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
// Basic usage
const { focus, promptContext, ctx } = useAskable();

// Click-only activation
const { focus: clickFocus } = useAskable({ events: ['click'] });

// Hover-only activation
const { focus: hoverFocus } = useAskable({ events: ['hover'] });

// Focus-only activation
const { focus: focusOnly } = useAskable({ events: ['focus'] });

// Named shared context for one surface
const { focus: chartFocus } = useAskable({
  name: 'chart',
  events: ['click', 'hover'],
});

// Private context options for one hook instance
const privateAskable = useAskable({
  maxHistory: 10,
  sanitizeText: (text) => text.trim(),
  sanitizeMeta: (meta) => {
    const { internalId, ...safe } = meta;
    return safe;
  },
  textExtractor: (el) => el.getAttribute('aria-label') ?? el.textContent ?? '',
});

// Custom context (multiple independent AI surfaces)
import { createAskableContext } from '@askable-ui/core';
const myCtx = createAskableContext();
myCtx.observe(panelEl, { events: ['hover'] });

const { focus: panelFocus } = useAskable({ ctx: myCtx });
```

---

## `useAskableSource(id, source, options?)`

Lifecycle-managed registration for app-owned context sources. Use this when the
assistant needs data that is not fully rendered in the DOM: paginated tables,
virtualized lists, documents, charts, maps, calendars, canvases, file trees, or
custom state.

The hook registers the source after mount, keeps the latest resolver functions
current across rerenders, and unregisters automatically on unmount.

```tsx
import { useEffect } from 'react';
import { useAskableSource } from '@askable-ui/react';

function AccountsContextSource({ table, filters, sort }) {
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

  async function ask(question: string) {
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

### Practical option patterns

#### Shared default hook

```tsx
function ChatInput() {
  const { promptContext } = useAskable();
  return <textarea defaultValue={promptContext} />;
}
```

#### Private hook instance with sanitization

When you pass context-creation options like `maxHistory`, `sanitizeMeta`, `sanitizeText`, or `textExtractor` without `name` or `ctx`, React creates a private context for that hook instance.

```tsx
function SafeSupportPanel() {
  const { promptContext } = useAskable({
    maxHistory: 5,
    sanitizeMeta: ({ internalId, ...safe }) => safe,
    sanitizeText: (text) => text.replace(/\s+/g, ' ').trim(),
    textExtractor: (el) => el.getAttribute('data-askable-text') ?? el.textContent ?? '',
  });

  return <textarea defaultValue={promptContext} />;
}
```

#### Pre-created custom context

```tsx
import { createAskableContext } from '@askable-ui/core';

function AnalyticsPanel({ panelEl }: { panelEl: HTMLElement }) {
  const ctx = useMemo(() => {
    const next = createAskableContext({ maxHistory: 20 });
    next.observe(panelEl, { events: ['click'] });
    return next;
  }, [panelEl]);

  const { promptContext } = useAskable({ ctx });
  return <textarea defaultValue={promptContext} />;
}
```

#### Explicit "Ask AI" button flow with `ctx.select()`

```tsx
function RevenueCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const { ctx } = useAskable({ events: ['click'] });

  return (
    <Askable ref={cardRef} meta={{ widget: 'revenue-card' }}>
      <RevenueChart />
      <button
        onClick={() => {
          if (cardRef.current) ctx.select(cardRef.current);
          openChat();
        }}
      >
        Ask AI
      </button>
    </Askable>
  );
}
```

#### Touch-device note

On touch-like devices, Askable maps `hover` to tap/click by default. That means `useAskable({ events: ['hover'] })` still works on mobile-style environments, but the trigger comes from a tap rather than a pointer hover.

### Shared vs custom contexts

`useAskable()` has three common modes in React:

- **Default shared context** — `useAskable()` with no `ctx` or `name` reuses one shared document observer for the same `events` + `viewport` configuration.
- **Named shared context** — `useAskable({ name: 'chart' })` reuses a separate shared context for one UI region or surface.
- **Custom context** — `useAskable({ ctx })` attaches to an explicitly created `AskableContext` that you observe/configure yourself.

Use a shared context when multiple components on the same page should agree on the same focus/history. Provide a custom `ctx` when you need isolation, a custom root element, or different lifecycle control.

```tsx
function SharedChatInput() {
  const { promptContext } = useAskable({ events: ['hover'] });
  return <textarea defaultValue={promptContext} />;
}

function PrivatePanel({ panelEl }: { panelEl: HTMLElement }) {
  const ctx = useMemo(() => {
    const next = createAskableContext();
    next.observe(panelEl, { events: ['click'] });
    return next;
  }, [panelEl]);

  const { promptContext } = useAskable({ ctx });
  return <textarea defaultValue={promptContext} />;
}
```

---

## `useAskableRegionCapture(options?)`

React hook for explicit region, circle, and lasso capture. It mounts a temporary browser
overlay, tracks active state, and stores the last captured Context packet.

```tsx
import { useAskable, useAskableRegionCapture } from '@askable-ui/react';

function DashboardCapture() {
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

**Options:**

| Option | Type | Description |
|---|---|---|
| `shape` | `'region' \| 'circle' \| 'lasso'` | Default shape for `start()` |
| `minSize` | `number` | Minimum accepted width/height in CSS pixels |
| `once` | `boolean` | Remove the overlay after the first accepted capture |
| `theme` | `Partial<AskableRegionCaptureTheme>` | Override overlay colors, selection fill/stroke, and lasso gradient/glow styling |
| `onCapture` | `(packet, selection) => void` | Called when the user completes a selection |
| `onCancel` | `() => void` | Called when selection is cancelled |
| `ctx` | `AskableContext` | Reuse an existing context |
| `includeViewport` | `boolean` | Include visible annotated elements in the emitted packet |
| `source`, `intent`, `privacy`, `provenance` | context packet options | Passed through to packet serialization |

**Returns:**

| Value | Type | Description |
|---|---|---|
| `ctx` | `AskableContext` | Context used for packet serialization |
| `active` | `boolean` | Whether the overlay is currently active |
| `lastPacket` | `WebContextPacket \| null` | Last captured packet |
| `lastSelection` | `AskableRegionCaptureSelection \| null` | Last captured geometry; lasso includes point path metadata |
| `start(overrides?)` | `function` | Start capture, optionally overriding shape/intent/etc. |
| `cancel()` | `function` | Cancel the active overlay |
| `destroy()` | `function` | Remove the overlay without firing cancel |
| `isActive()` | `function` | Read active state from the live capture handle |

For persistent capture tools, pass `once: false`. The overlay and `active` state
stay on after each accepted capture until the user cancels or the component
unmounts.

---

## `useAskableTextSelectionCapture(options?)`

React hook for highlighted text capture. It can listen to browser selection
changes or capture the current selection on demand.

```tsx
import { useAskableTextSelectionCapture } from '@askable-ui/react';

function TextSelectionCapture() {
  const selection = useAskableTextSelectionCapture({
    includeViewport: true,
    intent: 'answer using this highlighted text',
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

**Options:** `root`, `minLength`, `debounce`, `once`, `dedupe`, `onCapture`,
`onCancel`, `ctx`, and packet options such as `includeViewport`, `source`,
`intent`, `privacy`, and `provenance`.

**Returns:** `ctx`, `active`, `lastPacket`, `lastSelection`, `start(overrides?)`,
`captureNow(overrides?)`, `cancel()`, `destroy()`, and `isActive()`.
