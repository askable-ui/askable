# What’s New in v0.15.0

askable-ui v0.15.0 ships two new context source families — ecommerce cart
tracking and wizard/stepper progress — and updates all six framework packages
(React, Vue, Svelte, SolidJS, Angular, web-component) in one release.

## Highlights

### Cart source

`useAskableCartSource()` exposes real-time shopping cart state so AI assistants
can answer questions about cart contents, totals, and discounts without any
additional description from the developer.

```ts
import { useAskableCartSource } from ‘@askable-ui/react’;

const { snapshot, addItem, removeItem, updateQuantity, setTotals, clearCart } =
  useAskableCartSource({
    items: [{ id: ‘sku-1’, name: ‘T-Shirt’, price: 29.99, quantity: 2 }],
    totals: { tax: 5.40, shipping: 4.99, currency: ‘USD’ },
  });

// The assistant can now answer:
// "How many items are in my cart?"
// "What is my order total with tax?"
// "Do I qualify for free shipping?"
```

The snapshot includes `items`, `itemCount`, `totalQuantity`, `subtotal`,
`discount`, `tax`, `shipping`, `total` (clamped to ≥ 0), `currency`,
`couponCode`, `isEmpty`, and `lastModifiedAt`.

Mutators work the same across frameworks:

| Method | Behaviour |
|---|---|
| `addItem(item)` | Add or replace by `id` |
| `removeItem(id)` | Remove by `id` |
| `updateQuantity(id, qty)` | Update quantity; removes when `qty ≤ 0` |
| `setItems(items)` | Replace entire item list |
| `setTotals(totals)` | Update discount, tax, shipping, currency, couponCode |
| `clearCart()` | Empty cart, preserving currency |

Angular apps use the `AskableCartSourceService` injectable with the same methods.

### Multistep / wizard source

`useAskableMultistepSource()` tracks wizard and stepper progress so the
assistant always knows which step the user is on, how far they’ve come, and
whether the flow is complete.

```ts
import { useAskableMultistepSource } from ‘@askable-ui/react’;

const { snapshot, goTo, next, prev, complete, reset } = useAskableMultistepSource({
  steps: [
    { id: ‘account’, label: ‘Account details’ },
    { id: ‘billing’, label: ‘Billing info’ },
    { id: ‘confirm’, label: ‘Confirm order’ },
  ],
  currentId: ‘billing’,
});
// snapshot.progress === 50   (0–100)
// snapshot.currentLabel === ‘Billing info’
// snapshot.isComplete === false
```

The snapshot includes `steps`, `currentId`, `currentIndex`, `currentLabel`,
`totalSteps`, `progress`, `isFirstStep`, `isLastStep`, and `isComplete`.

Angular apps use the `AskableMultistepSourceService` injectable.

## Also in v0.14.0

# What’s New in v0.14.0

askable-ui v0.14.0 adds browser-local MCP page resources, so trusted
extensions and local companions can read approved page context as
`askable://current` without scraping the DOM.

## Highlights

### Browser-local MCP page resources

`@askable-ui/mcp` now supports `read_current_resource` in
`createAskableMcpPageBridge()`. The page can answer a versioned
`window.postMessage()` request with a resource-shaped payload that maps cleanly
to MCP `resources/read` output.

```ts
window.postMessage({
  protocol: 'askable.mcp.page_bridge',
  version: '0.1',
  channel: 'askable:mcp',
  type: 'read_current_resource',
  requestId: crypto.randomUUID(),
  options: {
    sources: ['accounts'],
    resource: {
      uri: 'askable://current',
      format: 'packet',
    },
  },
}, window.location.origin);
```

Set `resource.format` to `prompt` when the local companion needs `text/plain`
prompt context instead of packet JSON. Resource options are stripped before the
context provider runs, so existing providers continue to receive only normal
context options.

### Website and starter alignment

The main website navigation now uses a compact split-pill header, and the WebMCP
section calls out `read_current_resource` alongside hosted MCP. New starter apps
now pin Askable packages to `^0.14.0`.

## Also in v0.13.1

askable-ui v0.13.1 adds production-ready Web MCP support and stronger agent
request wiring, so approved Claude and ChatGPT clients can request selected UI
context through a hosted MCP endpoint.

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
Context packet, prompt-ready text, or an `askable://current` resource while the
extension or companion exposes the local MCP server.

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

`npm create @askable-ui/app` now scaffolds projects pinned to `^0.14.0`, and the
versioned docs have been advanced to `/docs/v0.14.0/`.

## Recommended next step

If you are integrating Askable into an AI or agent runtime, start here:

1. [Getting Started](/guide/getting-started)
2. [Context Packets](/guide/context)
3. [@askable-ui/core API](/api/core)

## Version note

The current published docs track **v0.15.0** at both:

- `/docs/`
- `/docs/v0.15.0/`
