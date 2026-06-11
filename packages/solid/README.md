# @askable-ui/solid

SolidJS primitives for **askable-ui** — give AI assistants real-time context about what users see and interact with. One attribute. No screenshots. No prompt engineering.

```bash
npm install @askable-ui/solid
```

## Usage

**Annotate elements**

```tsx
import { Askable, useAskable } from '@askable-ui/solid';

function Dashboard() {
  const { focus, promptContext } = useAskable();

  return (
    <>
      <Askable meta={{ metric: 'revenue', value: '$2.34M', delta: '+12%' }}>
        <article>Revenue: $2.34M</article>
      </Askable>

      {/* promptContext() is ready to inject into any LLM */}
      <p>{promptContext()}</p>
    </>
  );
}
```

**Viewport tracking**

```tsx
import { useAskableViewport } from '@askable-ui/solid';

const { visibleItems, promptContext } = useAskableViewport({ threshold: 0.5 });
// Track every [data-askable] element currently on screen
```

**Navigation history**

```tsx
import { useAskableHistory } from '@askable-ui/solid';

const { history, promptContext } = useAskableHistory({ maxEntries: 5 });
// Let the AI know where the user has been, not just where they are
```

**Typed meta**

```ts
import { asMeta } from '@askable-ui/solid';

interface KpiMeta { metric: string; value: string; delta: string }
const kpi = asMeta<KpiMeta>(focus()!);
kpi.meta.value; // string, not unknown
```

## Inject into an LLM

```tsx
const { promptContext } = useAskable();

// Vercel AI SDK
const { messages } = useChat({ body: { uiContext: promptContext() } });

// Any SDK
fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ messages, uiContext: promptContext() }),
});
```

## API

| Export | Description |
|---|---|
| `useAskable(options?)` | Reactive focus + `promptContext()` signal |
| `useAskableViewport(options?)` | Reactive list of all visible annotated elements |
| `useAskableHistory(options?)` | Navigation trail of recent focuses |
| `<Askable meta={...}>` | Wrapper component that sets `data-askable` |
| `asMeta<T>(focus)` | Cast `focus.meta` to your typed schema |

## Links

- [askable-ui.com](https://askable-ui.com) — docs and demos
- [GitHub](https://github.com/askable-ui/askable) — source, issues, examples
- [npm](https://www.npmjs.com/package/@askable-ui/solid)
