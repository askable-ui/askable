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
- all core `AskableInspectorOptions` props such as `position`, `highlight`, and `promptOptions`
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
