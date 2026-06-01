# Context Packets

Prompt strings are useful for simple chat integrations. Context packets are
for agents, MCP bridges, browser extensions, and tools that need structured
context instead of prose.

The open specification lives at [askable-ui/context-standard](https://github.com/askable-ui/context-standard).

```ts
const packet = ctx.toContextPacket({
  history: 3,
  includeViewport: true,
  source: { app: 'analytics-dashboard' },
});

const packetWithSources = await ctx.toContextPacketAsync({
  source: { app: 'analytics-dashboard' },
  sources: [{ id: 'accounts', mode: 'summary', maxItems: 20 }],
});
```

The packet describes:

- where the context came from: URL, title, app, route, timestamp
- how the context was captured: focused element, selected text, semantic push, viewport, region, lasso, circle, or custom capture
- what the user is pointing at: text, role, label, selector, bounds, metadata, optional screenshots
- surrounding context: ancestors, visible items, recent interactions, and app-owned sources
- privacy and provenance: redaction state, consent state, producer, and capture method

## Why packets?

`toPromptContext()` optimizes for copy-paste simplicity:

```ts
ctx.toPromptContext();
// "User is focused on: — metric: revenue — value \"Revenue\""
```

`toContextPacket()` optimizes for interoperability:

```json
{
  "protocol": "askable.context",
  "version": "0.1",
  "capture": { "mode": "element-focus", "gesture": "focus" },
  "target": {
    "text": "Revenue",
    "metadata": { "metric": "revenue", "value": "$2.3M" }
  },
  "privacy": { "redacted": false, "consent": "implicit" },
  "provenance": { "producer": "@askable-ui/core", "method": "app" }
}
```

Use packets when the receiving system should validate, store, transform, or
route context before sending it to a model.

## App-owned sources

When a page only renders part of the underlying data, register a source and use
`toContextPacketAsync()` to include resolver-backed application context in
`surrounding.sources`.

```ts
import { createAskableCollectionSource } from '@askable-ui/core';

ctx.registerSource('accounts', createAskableCollectionSource({
  describe: 'Customer accounts matching the active filters',
  getState: () => ({ filters, sort, page, pageSize, totalCount }),
  getVisibleItems: () => table.getRowModel().rows.map((row) => row.original),
  getItems: () => accountStore.getAllMatching({ filters, sort }),
  getSummary: ({ maxItems }) => summarizeAccounts({ filters, sort, maxItems }),
  sanitizeItem: redactAccountFields,
  sanitize: (source) => ({
    ...source,
    state: redactFilterState(source.state),
  }),
}));

const packet = await ctx.toContextPacketAsync({
  sources: [{ id: 'accounts', mode: 'all', maxItems: 20, timeoutMs: 750 }],
  sourceErrorMode: 'include',
});
```

Each source becomes a `WebContextTarget` with the source id in `label`, source
kind in `role`, source description in `text`, and resolved state/data in
`metadata`. Failed sources use a safe unavailable marker by default so packet
consumers do not receive stack traces or secret-bearing error messages.

## MCP bridge

`@askable-ui/mcp` exposes packets through MCP tools and resources. The built-in
provider adapts an existing `AskableContext`:

```ts
import { createAskableMcpContextProvider, createAskableMcpServer } from '@askable-ui/mcp';

const server = createAskableMcpServer({
  provider: createAskableMcpContextProvider(ctx, {
    history: 3,
    includeViewport: true,
  }),
});
```

The server registers:

| Name | Kind | Purpose |
|---|---|---|
| `context://schema` | Resource | JSON Schema for Context packets |
| `get_current_context` | Tool | Returns the current structured packet |
| `get_context_schema` | Tool | Returns the packet schema |
| `format_context_for_prompt` | Tool | Returns a prompt-ready rendering |

The MCP package does not choose a transport. Use the returned MCP server with
stdio, Streamable HTTP, or an embedded runtime depending on where context is
captured.

## Privacy

Packets reflect the same sanitizers as prompt serialization:

```ts
const ctx = createAskableContext({
  sanitizeMeta: ({ ssn, ...safe }) => safe,
  sanitizeText: (text) => text.replace(/\b\d{16}\b/g, '[card]'),
});

ctx.toContextPacket().privacy.redacted;
// true
```

Set explicit consent/provenance metadata when context is captured from browser
extensions, region selection, or user-triggered actions:

```ts
ctx.toContextPacket({
  privacy: { consent: 'explicit' },
  provenance: { producer: 'my-browser-extension', method: 'extension' },
});
```

## Region, circle, and lasso capture

For "send this part of the page" interactions, `@askable-ui/core` can mount a
temporary drag overlay and emit a packet with selected geometry:

```ts
import { createAskableContext, createAskableRegionCapture } from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const capture = createAskableRegionCapture(ctx, {
  shape: 'lasso',
  intent: 'explain this selected chart segment',
  includeViewport: true,
  theme: {
    lassoStrokeWidth: 4,
  },
  onCapture: (packet) => {
    sendToAgent(packet);
  },
});

capture.start();
```

The resulting packet uses `capture.mode` of `region`, `circle`, or `lasso`,
sets `privacy.consent` to `explicit`, and places the selected bounds on
`target.bounds`. Lasso packets also include the freehand path in
`target.metadata.points`. The default lasso overlay uses
`ASKABLE_REGION_CAPTURE_THEME`; pass `theme` to adjust overlay colors,
selection fill/stroke, or lasso line styling.

Framework apps can use wrapper APIs instead:

```tsx
import { useAskable, useAskableRegionCapture } from '@askable-ui/react';

const { ctx } = useAskable({ viewport: true });
const capture = useAskableRegionCapture({
  ctx,
  includeViewport: true,
  onCapture: (packet) => sendToAgent(packet),
});
```

```ts
import { useAskableRegionCapture } from '@askable-ui/vue';

const capture = useAskableRegionCapture({
  includeViewport: true,
  onCapture: (packet) => sendToAgent(packet),
});
```

```ts
import { createAskableRegionCaptureStore } from '@askable-ui/svelte';

const capture = createAskableRegionCaptureStore({
  includeViewport: true,
  onCapture: (packet) => sendToAgent(packet),
});
```

## Text selection capture

Use text selection capture when the user highlights copy in the page and wants
that exact selected range sent to an agent:

```ts
import { createAskableContext, createAskableTextSelectionCapture } from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const selection = createAskableTextSelectionCapture(ctx, {
  intent: 'answer using the highlighted text',
  includeViewport: true,
  onCapture: (packet) => {
    sendToAgent(packet);
  },
});

selection.start();
```

The resulting packet uses `capture.mode` of `text-selection`, sets
`privacy.consent` to `explicit`, and places the selected text on `target.text`.

Framework wrappers expose the same behavior:

```tsx
import { useAskableTextSelectionCapture } from '@askable-ui/react';

const selection = useAskableTextSelectionCapture({
  includeViewport: true,
  onCapture: (packet) => sendToAgent(packet),
});
```

```ts
import { useAskableTextSelectionCapture } from '@askable-ui/vue';

const selection = useAskableTextSelectionCapture({
  includeViewport: true,
  onCapture: (packet) => sendToAgent(packet),
});
```

```ts
import { createAskableTextSelectionCaptureStore } from '@askable-ui/svelte';

const selection = createAskableTextSelectionCaptureStore({
  includeViewport: true,
  onCapture: (packet) => sendToAgent(packet),
});
```
