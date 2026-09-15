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
  const { ctx } = useAskable();

  async function submit(question: string) {
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await ctx.toAgentRequest(question, {
        history: 3,
        packet: true,
      })),
    });
  }
}
```

For very small integrations you can still inject `promptContext` directly as a
system message:

```tsx
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

## Review context before sending (unreleased)

::: warning Availability
`useAskableChat().appendRequest()` and its handler's fourth `signal` argument
are unreleased React additions on the main branch. They are not in npm `0.17.3`.
:::

Use `append(question, handler)` for immediate submission with live context. Use
`appendRequest(request, handler)` when a user must approve the selected context
first. The latter does not read the current focus or resolve sources again, and
does not reapply the hook's `systemPrompt` or `requestOptions`.

### Prepare and review

Build a request from the pinned packet returned by text, region, circle, square,
or lasso capture. Resolve any additional app-owned data now, apply your prompt
formatting and sanitization, then detach a JSON snapshot before displaying it:

```tsx
import { useAskableChat } from '@askable-ui/react';
import type { AskableAgentRequest } from '@askable-ui/core';
import type { WebContextPacket } from '@askable-ui/context';

// Inside your chat component:
const { ctx, appendRequest, abort, status, error } = useAskableChat();

async function prepareReview(question: string, selection: WebContextPacket) {
  const request = await ctx.toAgentRequest(question, {
    requestId: crypto.randomUUID(),
    packet: selection,
    contextFromPacket: true,
    selectionFromPacket: true,
    // Include only sources approved for this flow and registered by your app.
    sources: [{ id: 'page-data', mode: 'summary' }],
    sourceErrorMode: 'throw',
  });
  return JSON.parse(JSON.stringify(request)) as AskableAgentRequest;
}
```

Store the returned request in component state. Show its question, context,
packet, metadata, and any history your transport includes. A highlighted region
is only the selection, not necessarily the complete payload. Request `focus`
can describe the current live focus even when `contextFromPacket` pins the
prompt to a previous selection; omit that field in your transport if unused.

Keep the reviewed object unchanged. If the user edits the question, removes a
source, switches selections, or navigates away, invalidate the old review and
prepare a new one. Ignore late preparation results after dismissal, using a
generation counter or equivalent lifecycle guard. Catch preparation failures in
the review UI; this preparation happens before the chat hook is called.

Apply real sanitizers to all transmitted fields before review. A packet's
`privacy.redacted` flag is an assertion, not a filter. Removing a displayed
attachment alone does not remove its content from `context`, `focus`, packet
sources, metadata, or prior messages.

### Send the approved snapshot

```tsx
async function sendApproved(approved: AskableAgentRequest) {
  await appendRequest(approved, async (request, messages, emit, signal) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        request,
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
    });
    if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
    if (!response.body) throw new Error('Chat response has no body');

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        emit(value);
      }
    } finally {
      reader.releaseLock();
    }
  });
}
```

This example expects a plain-text streaming endpoint, not an SSE or AI SDK
event stream. Use your provider's parser for those formats. Map history to the
fields needed by the endpoint instead of serializing every message's stored
request again. Show which prior turns are included in the review as well.

The hook copies the JSON-ready request synchronously at submission, preserving
its request ID. Later edits to the original object cannot change the send.
Both send methods report errors through `status`, `error`, and `onError`; they
do not reject for context or transport failures. Wire a Stop button to `abort()`
and forward the signal to your transport. Stopping returns to `idle` and keeps
partial output. It cannot undo a server-side action that already happened.

For another chat surface, pass the same approved request with a packet to
[`bridge.sendAgentRequest()`](/guide/bridge#sending-an-existing-agent-request).
Use only the approved transport and inspect every returned ack. Do not describe
a bridge dispatch as chatbot acknowledgement or automatically retry an unknown
delivery. This API does not implement deduplication or retry policy.

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

Hook that connects to a shared context for the requested `events` configuration. Observation starts after mount, consumers with the same `events` reuse one observer lifecycle, and each shared context stops when its last consumer unmounts.

```ts
const { focus, promptContext, ctx } = useAskable();

// Click only
const { focus } = useAskable({ events: ['click'] });

// Inline context options — creates a private context (not the singleton)
const { focus } = useAskable({ maxHistory: 10 });
const { focus } = useAskable({ sanitizeMeta: ({ secret, ...rest }) => rest });

// Scoped to a pre-created context instance
const { focus } = useAskable({ ctx: myCtx });
```

When any `AskableContextOptions` are provided (`maxHistory`, `sanitizeMeta`, `sanitizeText`, `textExtractor`), a private context is created for that component instead of sharing the per-`events` context.

**Options:**
| Option | Type | Description |
|---|---|---|
| `events` | `AskableEvent[]` | Which events trigger updates. Defaults to `['click', 'hover', 'focus']`. |
| `maxHistory` | `number` | History buffer size. Defaults to 50. Set to `0` to disable. |
| `sanitizeMeta` | `(meta) => meta` | Redact sensitive metadata keys before storage. |
| `sanitizeText` | `(text) => string` | Redact sensitive text content before storage. |
| `textExtractor` | `(el) => string` | Custom text extraction function. |
| `ctx` | `AskableContext` | Use a pre-created context (ignores all options above). |

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

## Region, circle, and lasso capture

For visual "send this part of the page" flows, use
`useAskableRegionCapture()` with the same context that powers the rest of your
React UI.

```tsx
import { useAskable, useAskableRegionCapture } from '@askable-ui/react';

function RegionTools() {
  const { ctx } = useAskable({ viewport: true });
  const capture = useAskableRegionCapture({
    ctx,
    includeViewport: true,
    selectionAffordance: {
      label: 'Selected context',
      dismissible: true,
      prompt: {
        placeholder: 'Ask about this area...',
        initialValue: 'What should I notice here?',
        onSubmit(question, packet) {
          sendToAgent({ question, context: packet });
        },
      },
    },
    theme: {
      lassoStrokeWidth: 4,
      lassoGlowRadius: 12,
    },
    onCapture(packet) {
      sendToAgent(packet);
    },
  });

  return (
    <div>
      <button onClick={() => capture.start({ shape: 'region' })}>
        Select region
      </button>
      <button onClick={() => capture.start({ shape: 'square' })}>
        Select square
      </button>
      <button onClick={() => capture.start({ shape: 'circle' })}>
        Circle area
      </button>
      <button onClick={() => capture.start({ shape: 'lasso' })}>
        Lasso area
      </button>
      {capture.active && <button onClick={capture.cancel}>Cancel</button>}
    </div>
  );
}
```

Region and square packets use `capture.mode: 'region'`; square packets also set
`target.metadata.shape: 'square'`. Circle packets use
`capture.mode: 'circle'` and include center/radius metadata. Lasso packets use
`capture.mode: 'lasso'` and include freehand path points.
The default lasso overlay uses the core `ASKABLE_REGION_CAPTURE_THEME`; pass
`theme` when you need brand-specific overlay colors, line styling, or
selected-state defaults. Use `selectionAffordance` to keep the selected area
visible after capture and optionally attach a small prompt input to it.
The prompt focuses by default so the user can immediately revise or submit the
suggested question. Pass `dismissible: true` when users should be able to clear
the selected-context chip directly.

## Text selection capture

For "send this highlighted copy" flows, use `useAskableTextSelectionCapture()`.

```tsx
import { useAskableTextSelectionCapture } from '@askable-ui/react';

function TextSelectionTools() {
  const selection = useAskableTextSelectionCapture({
    includeViewport: true,
    intent: 'answer using the highlighted text',
    selectionAffordance: {
      label: 'Selected text',
      dismissible: true,
      prompt: {
        placeholder: 'Ask about this text...',
        initialValue: 'Explain this quote',
        onSubmit(question, packet) {
          sendToAgent({ question, context: packet });
        },
      },
    },
    onCapture(packet) {
      sendToAgent(packet);
    },
  });

  return (
    <div>
      <button onClick={() => selection.start()}>Watch selection</button>
      <button onClick={() => selection.captureNow()}>Send selected text</button>
      {selection.active && <button onClick={selection.cancel}>Cancel</button>}
    </div>
  );
}
```

Selection packets use `capture.mode: 'text-selection'` and include the
highlighted text in `target.text`. Use `selectionAffordance` to keep the
highlight visible after capture and optionally attach a small prompt input to
the selected range.

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

## Sanitization

Pass sanitizers inline to strip sensitive fields before they're stored or sent to an LLM:

```tsx
function App() {
  const { promptContext } = useAskable({
    sanitizeMeta: ({ password, token, ...safe }) => safe,
    sanitizeText: (text) => text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[card]'),
  });
  // ...
}
```

When `sanitizeMeta` or `sanitizeText` are provided, a private context is created for that component. For app-wide sanitization shared across all components, create a context manually:

```tsx
import { createAskableContext } from '@askable-ui/core';

// Create once at module level (or with useMemo)
const safeCtx = createAskableContext({
  sanitizeMeta: ({ password, token, ...safe }) => safe,
});

function App() {
  const { promptContext } = useAskable({ ctx: safeCtx });
}
```

See [Annotating → Sanitization](/guide/annotating#sanitization-and-redaction) for details.

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
