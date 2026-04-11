# Askable Context Capture — React Example

Demonstrates the core askable-ui interaction pattern: annotate UI regions, capture focus context, and hand it off to any AI layer (CopilotKit, Vercel AI SDK, or your own backend).

## What it shows

- Metric cards annotated with `<Askable meta={...}>`
- Explicit "Ask AI" buttons using `ctx.select()`
- A side panel displaying the captured `promptContext`
- A clear integration point for CopilotKit or AI SDK wiring

## Running

```bash
npm install
npm run dev
```

## Integrating with CopilotKit

Wire `promptContext` into CopilotKit's `useCopilotReadable`:

```tsx
import { useAskable } from '@askable-ui/react';
import { useCopilotReadable } from '@copilotkit/react-core';

function App() {
  const { promptContext } = useAskable();

  useCopilotReadable({
    description: 'The UI element the user is currently focused on',
    value: promptContext,
  });

  return <Dashboard />;
}
```

## Integrating with Vercel AI SDK

```tsx
import { useAskable } from '@askable-ui/react';
import { useChat } from 'ai/react';

function App() {
  const { ctx } = useAskable();
  const { messages, input, handleSubmit } = useChat({
    body: { context: ctx.toContext({ history: 5 }) },
  });

  return <Chat messages={messages} />;
}
```

See the [docs](https://askable-ui.github.io/askable/docs/guide/) for full integration guides.
