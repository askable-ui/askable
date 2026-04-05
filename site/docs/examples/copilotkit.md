# CopilotKit Integration

Askable works as the UI-awareness layer for CopilotKit — Askable tracks *what the user is looking at*, CopilotKit handles the agentic workflow and chat UI.

## Install

```bash
npm install @askable-ui/react @askable-ui/core @copilotkit/react-core @copilotkit/react-ui
```

## Architecture

```
  Your UI                   Askable                CopilotKit
  ────────                  ───────                ──────────
  data-askable    ──►   toPromptContext()   ──►   useCopilotReadable()
  annotations           or toHistoryContext       injects into Copilot context
```

## Wiring askable context into CopilotKit

Use `useCopilotReadable` to inject the current UI focus into every Copilot action:

```tsx
'use client';
import { useAskable, Askable } from '@askable-ui/react';
import { useCopilotReadable } from '@copilotkit/react-core';

export function Dashboard({ data }) {
  const { promptContext, ctx } = useAskable();

  // Injects into CopilotKit's context on every focus change
  useCopilotReadable({
    description: 'The UI element the user is currently focused on',
    value: promptContext,
  });

  // Optionally include recent interaction history
  useCopilotReadable({
    description: 'Recent UI interactions (newest first)',
    value: ctx.toHistoryContext(5),
  });

  return (
    <div>
      <Askable meta={{ metric: 'revenue', delta: data.revenueDelta, period: 'Q3' }}>
        <RevenueChart data={data} />
      </Askable>

      <Askable meta={{ metric: 'churn', value: data.churnRate }}>
        <ChurnWidget data={data} />
      </Askable>
    </div>
  );
}
```

## App setup

```tsx
// app/layout.tsx
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';

export default function Layout({ children }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      {children}
      <CopilotPopup
        instructions="You are a helpful dashboard assistant. Use the UI context to give precise, data-aware answers."
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

## "Ask AI" button pattern with CopilotKit

Use `ctx.select()` to focus a specific element before opening the Copilot panel:

```tsx
'use client';
import { useRef } from 'react';
import { useAskable, Askable } from '@askable-ui/react';
import { useCopilotReadable, useCopilotAction } from '@copilotkit/react-core';
import { useCopilotChatSuggestions } from '@copilotkit/react-ui';

export function MetricCard({ data, onOpenChat }) {
  const { ctx } = useAskable();
  const cardRef = useRef<HTMLDivElement>(null);

  useCopilotReadable({
    description: 'Current UI focus',
    value: ctx.toPromptContext(),
  });

  useCopilotChatSuggestions({
    instructions: 'Suggest 3 questions about the currently focused metric',
    minSuggestions: 1,
    maxSuggestions: 3,
  });

  return (
    <Askable meta={data} ref={cardRef}>
      <MetricChart data={data} />
      <button
        onClick={() => {
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

| Pattern | When to use |
|---|---|
| **Passive** (`useCopilotReadable` auto-updates) | Chat panel is always open; context updates as user browses |
| **Explicit** (`ctx.select()` on button click) | Chat opens on demand; user should control when context is captured |

Both patterns can coexist — use passive observation for the general context and `select()` for specific "Ask AI about this" flows.
