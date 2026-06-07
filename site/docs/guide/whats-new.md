# What’s New in v0.13.1

askable-ui v0.13.1 adds production-ready Web MCP support and stronger agent
request wiring, so approved Claude and ChatGPT clients can request selected UI
context through a hosted MCP endpoint.

## Highlights

### Web MCP endpoint support

`@askable-ui/mcp` now ships `createAskableMcpWebHandler()`, a stateless
Streamable HTTP `Request -> Response` handler for Next.js, Vercel, Cloudflare
Workers, Bun, Deno, and Node 18+ runtimes.

```ts
import { createAskableMcpContextProvider, createAskableMcpWebHandler } from '@askable-ui/mcp';

const handler = createAskableMcpWebHandler({
  authorize: async (request) => {
    const token = await verifyMcpToken(request);
    if (!token) return false;
    return {
      authInfo: {
        token: token.value,
        clientId: token.clientId,
        scopes: token.scopes,
      },
    };
  },
  cors: {
    origin: ['https://app.example'],
    headers: ['Authorization', 'Content-Type', 'MCP-Protocol-Version'],
  },
  maxRequestBodyBytes: 256 * 1024,
  telemetry: (event) => metrics.timing('askable.mcp.duration', event.durationMs),
  provider: createAskableMcpContextProvider(ctx, {
    history: 3,
    includeViewport: true,
    sources: ['accounts'],
  }),
});

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
```

The web handler supports authorization, browser preflight handling, custom
request body limits, response headers, default `no-store`/`nosniff` headers,
and sanitized telemetry that omits request bodies, Context packets, prompt text,
and query strings.

`@askable-ui/mcp` also includes `createAskableMcpPageBridge()` for browser-local
MCP workflows. This is the page-side handoff for trusted extensions or local
companions: the page answers versioned `window.postMessage()` requests with a
Context packet or prompt-ready text, while the extension or companion exposes
the local MCP server.

Related docs:

- [@askable-ui/mcp API](/api/mcp)
- [AI SDK integration patterns](/examples/ai-sdk)

### Agent request validation

`@askable-ui/core` now exports `isAskableAgentRequest()` so server routes can
validate agent request payloads before using prompt context, packets, selected
source options, or user questions.

```ts
import { isAskableAgentRequest } from '@askable-ui/core';

if (!isAskableAgentRequest(body)) {
  return new Response('Invalid Askable request', { status: 400 });
}
```

Agent requests can also preserve packet-backed selections and source requests,
which keeps app-owned context available to downstream AI handlers.

## Also in v0.12.0

askable-ui v0.12.0 adds generic app-owned context sources and refines explicit
selection capture, so users can freehand lasso irregular areas, keep selected
text highlighted, and send richer page context to agents.

### Freehand lasso selection

`createAskableRegionCapture()` supports `shape: 'lasso'`. Lasso packets use
`capture.mode: 'lasso'`, set explicit consent, include selected bounds in
`target.bounds`, and include the freehand point path in `target.metadata.points`.
The overlay now renders as a solid gradient stroke instead of a dotted region,
which makes it feel closer to a cursor-drawn visual selection.
That gradient stroke is the library default, and apps can tune it with the
`theme` option instead of rebuilding the overlay.

```ts
import {
  ASKABLE_REGION_CAPTURE_THEME,
  createAskableContext,
  createAskableRegionCapture,
} from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const capture = createAskableRegionCapture(ctx, {
  shape: 'lasso',
  includeViewport: true,
  intent: 'answer using this freehand-selected region',
  theme: {
    ...ASKABLE_REGION_CAPTURE_THEME,
    lassoStrokeWidth: 4,
  },
  onCapture: (packet) => sendToAgent(packet),
});

capture.start();
```

Framework wrappers already expose the same `shape` override through
`useAskableRegionCapture()` for React and Vue, plus
`createAskableRegionCaptureStore()` for Svelte.

Related docs:

- [Context Packets](/guide/context)
- [@askable-ui/core API](/api/core)
- [@askable-ui/react API](/api/react)

### App-owned context sources

`registerSource()` lets apps expose data that is not fully represented in the
DOM. This covers paginated tables, virtualized lists, documents, maps, charts,
calendars, canvases, and custom product state.

```ts
import { createAskableCollectionSource } from '@askable-ui/core';

ctx.registerSource('accounts', createAskableCollectionSource({
  describe: 'Customer accounts matching the active filters',
  getState: () => ({ filters, sort, page, pageSize, totalCount }),
  getVisibleItems: () => table.getVisibleRows(),
  getSelectedItems: ({ selection }) => getAccountsByIds(selection),
  getItemId: (account) => account.id,
  getItems: () => accountStore.getAllMatching({ filters, sort }),
  getSummary: ({ maxItems }) => summarizeAccounts({ filters, sort, maxItems }),
  sanitizeItem: redactAccountFields,
}));

const promptContext = await ctx.toPromptContextAsync({
  sources: [{ id: 'accounts', mode: 'all', maxItems: 20 }],
});

const packet = await ctx.toContextPacketAsync({
  sources: [{ id: 'accounts', mode: 'all', maxItems: 20 }],
});
```

React apps can register the same source with component lifecycle:

```tsx
const accounts = useAskableSource('accounts', {
  getState: () => ({ filters, sort, totalCount }),
  resolve: async ({ mode, maxItems }) => {
    if (mode === 'visible') return table.getRowModel().rows.map((row) => row.original);
    return summarizeAccounts({ filters, sort, maxItems });
  },
});
```

Vue apps get the same lifecycle-managed source registration:

```ts
const accounts = useAskableSource('accounts', {
  getState: () => ({ filters: filters.value, sort: sort.value, totalCount: totalCount.value }),
  resolve: async ({ mode, maxItems }) => {
    if (mode === 'visible') return table.getRowModel().rows.map((row) => row.original);
    return summarizeAccounts({ filters: filters.value, sort: sort.value, maxItems });
  },
});
```

Svelte apps can use the store-based source helper:

```ts
const accounts = createAskableSourceStore('accounts', {
  getState: () => ({ filters, sort, totalCount }),
  resolve: async ({ mode, maxItems }) => {
    if (mode === 'visible') return table.getRowModel().rows.map((row) => row.original);
    return summarizeAccounts({ filters, sort, maxItems });
  },
});
```

This keeps Askable generic: interactions capture what the user meant, while
source resolvers supply what the app knows.

### Source-backed live subscriptions

`subscribeAsync()` streams `toContextAsync()` output to chat transports while
including registered sources. It debounces rapid focus changes and ignores stale
resolver results if the user moves to newer context before an earlier source
request finishes.

```ts
const unsubscribe = ctx.subscribeAsync(sendLiveContext, {
  history: 5,
  sources: [{ id: 'accounts', mode: 'summary', timeoutMs: 750 }],
  debounce: 100,
});
```

`toAgentRequest()` packages a user question with `toContextAsync()` output,
serialized focus, optional packet data, tracing metadata, and a timestamp:

```ts
const request = await ctx.toAgentRequest(question, {
  requestId,
  history: 3,
  sources: ['accounts'],
  packet: true,
});
```

You can also pass a packet that came from a region, circle, lasso, or text
selection capture. This supports a controlled UX where the user selects context,
sees it pinned in the chat composer, then adds a question before sending.
Set `contextFromPacket: true` when the prompt string should be generated from
that pinned selection instead of the current hover or click focus.
Set `selectionFromPacket: true` when registered sources should use that packet
target to resolve selected app data that may not be visible in the DOM.
String source includes use `mode: 'selected'` by default in this flow unless
`sourceMode` is set explicitly.

### Region, circle, lasso, and text capture together

Askable now covers four explicit user selection patterns:

- draw a rectangle with `createAskableRegionCapture()`
- circle something on screen with `shape: 'circle'`
- lasso an irregular shape with `shape: 'lasso'`
- highlight copy with `createAskableTextSelectionCapture()`

All four produce the same versioned Context packet format for MCP bridges,
browser tools, and agent runtimes.

### Starter and docs version alignment

`npm create @askable-ui/app` now scaffolds projects pinned to `^0.13.1`, and the
versioned docs have been advanced to `/docs/v0.13.1/`.

## Recommended next step

If you are integrating Askable into an AI or agent runtime, start here:

1. [Getting Started](/guide/getting-started)
2. [Context Packets](/guide/context)
3. [@askable-ui/core API](/api/core)

## Version note

The current published docs track **v0.13.1** at both:

- `/docs/`
- `/docs/v0.13.1/`
