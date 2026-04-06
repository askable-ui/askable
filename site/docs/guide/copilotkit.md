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

## Context-in-input pattern (recommended)

Rather than auto-sending to the LLM when the user selects an element, a better UX shows the focused context **in the chat input area** and lets the user add their own question before sending. This gives users control and leads to higher-quality conversations.

```
[ KPI: revenue $128k +12%  ×  ]   ← context bar, visible before sending
[ Why is this growing?          ]   ← input pre-filled with a suggested question
[ Send ↑ ]
```

### Implementation

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useAskable } from '@askable-ui/react';
import { useCopilotChat } from '@copilotkit/react-core';
import { TextMessage, MessageRole } from '@copilotkit/runtime-client-gql';

/** Generates a default question based on element meta */
function defaultQuestion(meta: Record<string, unknown>): string {
  const w = String(meta.widget ?? meta.metric ?? '');
  if (w === 'revenue') return 'Why is MRR trending this way?';
  if (w === 'churn')   return 'What is driving churn?';
  if (w === 'arpu')    return 'How can we improve ARPU?';
  if (w === 'nps')     return 'What should we do with this NPS score?';
  if (meta.status === 'at_risk') return 'What is the recommended action for this account?';
  if (meta.status === 'churned') return 'Can we win this account back?';
  return 'Tell me about this.';
}

export function ContextAwareChat() {
  const { ctx, focus, promptContext } = useAskable();
  const { appendMessage } = useCopilotChat();

  const [inputValue, setInputValue] = useState('');
  const [contextDismissed, setContextDismissed] = useState(false);

  // When focus changes: show context bar and pre-fill input with suggestion
  useEffect(() => {
    if (!focus) return;
    setContextDismissed(false);
    const meta = focus.meta as Record<string, unknown>;
    setInputValue(typeof meta === 'object' ? defaultQuestion(meta) : '');
  }, [focus]);

  function handleDismiss() {
    setContextDismissed(true);
    ctx.clear();
    setInputValue('');
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');

    // Build a message that includes the UI context when available
    const ctxLine = !contextDismissed && focus
      ? `\n\n[UI context: ${ctx.toPromptContext()}]`
      : '';

    await appendMessage(
      new TextMessage({ content: text + ctxLine, role: MessageRole.User })
    );
  }

  const showContextBar = focus && !contextDismissed;

  return (
    <div className="chat-shell">
      {/* Context bar — appears when an element is selected */}
      {showContextBar && (
        <div className="context-bar">
          <span className="context-label">Context:</span>
          <span className="context-value">{promptContext}</span>
          <button onClick={handleDismiss} aria-label="Clear context">×</button>
        </div>
      )}

      {/* Input with pre-filled suggestion */}
      <div className="chat-input-row">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={
            focus
              ? 'Add your question or press Enter to send…'
              : 'Select an element, then ask anything…'
          }
          autoFocus={!!focus}
        />
        <button onClick={handleSend} disabled={!inputValue.trim()}>↑</button>
      </div>
    </div>
  );
}
```

Then mount this instead of the default CopilotKit input:

```tsx
<CopilotSidebar
  instructions="You are a dashboard assistant. The user can share UI context alongside their question."
  // hide the built-in input; render ContextAwareChat in its place
  Input={() => <ContextAwareChat />}
/>
```

::: tip Why this pattern works
The user sees *what context the AI will receive* before they commit to sending. This reduces hallucinations, builds trust, and makes the interaction feel intentional rather than automatic.
:::

### Using chat suggestions instead

If you prefer CopilotKit's built-in UI, use `useCopilotChatSuggestions` to auto-generate contextual prompts from the current focus. The user still initiates the send.

```tsx
import { useCopilotChatSuggestions } from '@copilotkit/react-ui';
import { useAskable } from '@askable-ui/react';

export function DashboardWithSuggestions() {
  const { focus } = useAskable();

  useCopilotChatSuggestions({
    instructions: focus
      ? `The user is focused on: ${JSON.stringify(focus.meta)}. Suggest 3 specific questions they might want answered about this element.`
      : 'Suggest 3 general questions about this dashboard.',
    minSuggestions: 2,
    maxSuggestions: 3,
  });

  return <Dashboard />;
}
```



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
