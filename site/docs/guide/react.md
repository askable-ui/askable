# React Guide

## Install

```bash
npm install @askable-ui/react @askable-ui/core
```

## Quick start

```tsx
import { Askable, useAskable } from '@askable-ui/react';

function Dashboard({ data }) {
  const { promptContext } = useAskable();

  return (
    <Askable meta={{ metric: 'revenue', value: data.revenue, period: 'Q3' }}>
      <RevenueChart data={data} />
    </Askable>
  );
}

function ChatInput() {
  const { promptContext } = useAskable();

  async function submit(question: string) {
    await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `UI context: ${promptContext}` },
          { role: 'user', content: question },
        ],
      }),
    });
  }
  // ...
}
```

## `<Askable>`

Renders a wrapper element with `data-askable` set from the `meta` prop. Defaults to a `div`.

```tsx
// Object meta
<Askable meta={{ widget: 'churn-rate', value: '4.2%' }}>
  <ChurnChart />
</Askable>

// String meta
<Askable meta="pricing page hero" as="section">
  <HeroSection />
</Askable>

// Forward a ref to the underlying element
const ref = useRef<HTMLDivElement>(null);
<Askable meta={data} ref={ref}>...</Askable>
```

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `meta` | `Record<string, unknown> \| string` | — | Metadata attached as `data-askable` |
| `as` | `keyof JSX.IntrinsicElements` | `"div"` | HTML element to render |
| `ref` | `Ref<HTMLElement>` | — | Forwarded to the underlying element |
| ...rest | — | — | All other props forwarded to the element |

## `useAskable(options?)`

Hook that connects to the shared global context. Observation starts after mount and stops when the last consumer unmounts.

```ts
const { focus, promptContext, ctx } = useAskable();

// Click only
const { focus } = useAskable({ events: ['click'] });

// Scoped to a custom context instance
const { focus } = useAskable({ ctx: myCtx });
```

**Options:**
| Option | Type | Description |
|---|---|---|
| `events` | `AskableEvent[]` | Which events trigger updates. Defaults to `['click', 'hover', 'focus']`. |
| `ctx` | `AskableContext` | Use a custom context instead of the global singleton. |

**Returns:**
| Value | Type | Description |
|---|---|---|
| `focus` | `AskableFocus \| null` | Current focused element data |
| `promptContext` | `string` | Natural-language context string, ready for LLM injection |
| `ctx` | `AskableContext` | Underlying context for advanced use |

## "Ask AI" button pattern

Use `ctx.select()` to explicitly set context when a user clicks a button, rather than relying on passive hover or focus:

```tsx
function MetricCard({ data }) {
  const { ctx } = useAskable();
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <Askable meta={data} ref={cardRef}>
      <RevenueChart data={data} />
      <button
        onClick={() => {
          ctx.select(cardRef.current!);
          openChatPanel();
        }}
      >
        Ask AI ✦
      </button>
    </Askable>
  );
}
```

See [Ask AI Button](/examples/ask-ai-button) for a full working example.

## History-aware context

Feed multi-step interaction history into your LLM instead of just the current focus:

```tsx
function ChatInput() {
  const { ctx } = useAskable();

  async function submit(question: string) {
    // Include last 5 interactions
    const historyContext = ctx.toHistoryContext(5);

    await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `Recent UI interactions:\n${historyContext}` },
          { role: 'user', content: question },
        ],
      }),
    });
  }
}
```

## Next.js / App Router

`useAskable()` is safe in Server Components tree — it observes the DOM only on the client, inside a `useEffect`. No special configuration needed.

```tsx
// app/dashboard/page.tsx — this is a Server Component
import { Dashboard } from './Dashboard'; // Dashboard uses useAskable() internally
export default function Page() {
  return <Dashboard />;
}
```

For `'use client'` boundaries, just ensure the component using `useAskable()` is a Client Component:

```tsx
'use client';
import { useAskable } from '@askable-ui/react';
// ...
```
