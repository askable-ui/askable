# askable-ui + SolidJS Dashboard

A SolidJS dashboard showing how `@askable-ui/solid` gives an AI real-time awareness of what the user is looking at.

```bash
npm install
npm run dev
# → http://localhost:5173
```

## What it shows

- `useAskable()` — reactive focus tracking (click any card or row)
- `useAskableViewport()` — all annotated elements currently visible on screen
- `useAskableHistory()` — the last 8 elements the user focused
- `useAskableCompose()` — merges all three into a single prompt string
- `asMeta<T>()` — typed access to `focus().meta`

The sidebar shows the composed context string that you'd inject into any LLM system prompt.

## How it works

```tsx
import {
  Askable, useAskable, useAskableViewport,
  useAskableHistory, useAskableCompose,
} from '@askable-ui/solid';

const { focus, promptContext: focusCtx } = useAskable();
const { promptContext: viewportCtx } = useAskableViewport();
const { promptContext: historyCtx } = useAskableHistory({ maxEntries: 8 });

// Pass a reactive accessor so Solid tracks signal reads
const { promptContext } = useAskableCompose(() => ({
  sections: [
    { label: 'Focused element', value: focusCtx() },
    { label: 'Visible elements', value: viewportCtx() },
    { label: 'Navigation trail', value: historyCtx() },
  ],
}));

// Inject into any LLM
fetch('/api/chat', { body: JSON.stringify({ uiContext: promptContext() }) });
```
