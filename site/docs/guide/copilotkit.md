# CopilotKit Integration Guide

Askable and CopilotKit solve different parts of the AI-native UI problem. Askable captures *what the user is looking at* as structured prompt context. CopilotKit provides the agentic workflow, chat UI, and runtime. Together they form a full UI copilot.

## The roles

| Layer | Tool | Responsibility |
|---|---|---|
| UI annotations | Askable | `data-askable` attributes + focus tracking |
| Context serialization | Askable | `toPromptContext()` / `toHistoryContext()` |
| Context injection | CopilotKit | `useCopilotReadable()` makes context available to every action |
| Chat UI | CopilotKit | `CopilotPopup` / `CopilotSidebar` |
| Agentic runtime | CopilotKit | `CopilotRuntime` + LLM adapter |

## Install

```bash
npm install @askable-ui/react @askable-ui/core @copilotkit/react-core @copilotkit/react-ui
```

## Quick start

### 1. Annotate your UI elements

```tsx
import { Askable } from '@askable-ui/react';

function Dashboard({ data }) {
  return (
    <div>
      <Askable meta={{ metric: 'revenue', value: data.revenue, delta: data.revenueDelta }}>
        <RevenueChart data={data} />
      </Askable>

      <Askable meta={{ metric: 'churn', value: data.churnRate, period: 'Q3' }}>
        <ChurnWidget data={data} />
      </Askable>
    </div>
  );
}
```

### 2. Wire Askable context into CopilotKit

Call `useCopilotReadable` with the current Askable context. CopilotKit injects it into every copilot action automatically.

```tsx
'use client';
import { useAskable } from '@askable-ui/react';
import { useCopilotReadable } from '@copilotkit/react-core';

export function DashboardWithCopilot({ data }) {
  const { promptContext, ctx } = useAskable();

  // Current focus — updates whenever the user interacts with an annotated element
  useCopilotReadable({
    description: 'The UI element the user is currently focused on',
    value: promptContext,
  });

  // Last 5 interactions — gives the copilot conversational context
  useCopilotReadable({
    description: 'Recent UI interactions (newest first)',
    value: ctx.toHistoryContext(5),
  });

  return <Dashboard data={data} />;
}
```

### 3. Set up the CopilotKit runtime and UI

```tsx
// app/layout.tsx (Next.js App Router)
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';

export default function Layout({ children }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      {children}
      <CopilotPopup
        instructions={[
          'You are a helpful analytics assistant.',
          'You can see which UI element the user is currently focused on.',
          'Use that context to give precise, data-aware answers.',
        ].join(' ')}
        labels={{ title: 'Dashboard AI', initial: 'Hi! Ask me about anything you see.' }}
      />
    </CopilotKit>
  );
}
```

```ts
// app/api/copilotkit/route.ts
import { CopilotRuntime, OpenAIAdapter } from '@copilotkit/runtime';
import OpenAI from 'openai';

const openai = new OpenAI();

export async function POST(req: Request) {
  const { handleRequest } = new CopilotRuntime();
  return handleRequest(req, new OpenAIAdapter({ openai }));
}
```

## "Ask AI" button pattern

For explicit, user-triggered context capture, use `ctx.select()` before the CopilotKit panel opens. This ensures the copilot always answers about the exact element the user clicked.

```tsx
'use client';
import { useRef } from 'react';
import { useAskable, Askable } from '@askable-ui/react';
import { useCopilotReadable } from '@copilotkit/react-core';
import { useCopilotChatSuggestions } from '@copilotkit/react-ui';

export function MetricCard({ data, onOpenChat }) {
  const { ctx } = useAskable();
  const cardRef = useRef<HTMLDivElement>(null);

  // Context is available to all copilot actions in scope
  useCopilotReadable({
    description: 'Focused UI element',
    value: ctx.toPromptContext(),
  });

  // Generate contextual suggestions based on the current focus
  useCopilotChatSuggestions({
    instructions: 'Suggest 3 questions the user might want to ask about this metric',
    minSuggestions: 1,
    maxSuggestions: 3,
  });

  return (
    <Askable meta={data} ref={cardRef}>
      <MetricChart data={data} />
      <button
        onClick={() => {
          // Explicitly capture this card's context before the panel opens
          ctx.select(cardRef.current!);
          onOpenChat();
        }}
      >
        Ask AI ✦
      </button>
    </Askable>
  );
}
```

## Passive vs. explicit focus

| Pattern | How it works | Best for |
|---|---|---|
| **Passive** | `promptContext` auto-updates via `useAskable()`; `useCopilotReadable` re-injects on every render | Persistent chat sidebar; context changes as user browses |
| **Explicit** | `ctx.select(el)` pins focus before chat opens | On-demand "Ask AI" buttons; deterministic context per card/row |

Both patterns can coexist. Use passive observation as the baseline and `select()` for specific high-signal actions.

## Filtering context for the copilot

Avoid sending sensitive or irrelevant fields to the copilot by using `excludeKeys` at serialization time:

```tsx
useCopilotReadable({
  description: 'Focused element',
  value: ctx.toPromptContext({ excludeKeys: ['_id', '_internalRef'] }),
});
```

Or configure redaction at context creation time so it applies to all outputs:

```ts
const ctx = createAskableContext({
  sanitizeMeta: ({ _id, internalRef, ...safe }) => safe,
});
```

## SSR and client-side boundaries

`useCopilotReadable` and `useAskable` are both client-only hooks. In Next.js App Router, mark any component that uses them with `'use client'`.

The Askable observer is deferred until `onMounted` (in Vue) or `useEffect` (in React), so importing the package in SSR contexts is safe. See [SSR Safety](/guide/ssr) for details.

::: tip CopilotKit wraps your app
The `CopilotKit` provider must wrap the components that call `useCopilotReadable`. In Next.js, put it in your root layout. The `CopilotPopup` / `CopilotSidebar` can live at the same level.
:::

## Full example

See the [CopilotKit example](/examples/copilotkit) for a complete working code sample.
