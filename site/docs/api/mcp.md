# @askable-ui/mcp

MCP bridge for exposing Context packets to agents.

```bash
npm install @askable-ui/mcp
```

```ts
import { createAskableContext } from '@askable-ui/core';
import { createAskableMcpContextProvider, createAskableMcpServer } from '@askable-ui/mcp';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const server = createAskableMcpServer({
  provider: createAskableMcpContextProvider(ctx, {
    history: 3,
    includeViewport: true,
    source: { app: 'analytics-dashboard' },
  }),
});
```

## `createAskableMcpContextProvider(ctx, defaults?)`

Adapts an existing `AskableContext` to the MCP provider interface.

| Option | Type | Description |
|---|---|---|
| `ctx` | `Pick<AskableContext, 'toContextPacket' \| 'toContext'>` plus optional async methods | Source context to expose through MCP |
| `defaults` | `AskableMcpContextOptions` | Default packet and prompt options applied to every tool call |

Defaults and tool-call options are merged. Nested `source`, `privacy`, and
`provenance` metadata are merged field-by-field.

When the provided context implements `toContextPacketAsync()` and
`toContextAsync()`, the built-in provider uses those methods so registered
app-owned sources can flow into MCP tools.

```ts
import { createAskableCollectionSource } from '@askable-ui/core';

ctx.registerSource('accounts', createAskableCollectionSource({
  describe: 'Accounts matching active filters',
  getState: () => ({ filters, sort, totalCount }),
  getVisibleItems: () => table.getVisibleRows(),
  getItems: () => accountStore.getAllMatching({ filters, sort }),
  getSummary: ({ maxItems }) => summarizeAccounts({ filters, sort, maxItems }),
  sanitizeItem: redactAccountFields,
}));

const provider = createAskableMcpContextProvider(ctx, {
  history: 3,
  includeViewport: true,
  sources: [{ id: 'accounts', mode: 'all', maxItems: 25, timeoutMs: 750 }],
  sourceErrorMode: 'include',
});
```

## `createAskableMcpServer(options)`

Creates an MCP server with tools/resources for reading structured Context packets.

| Option | Type | Description |
|---|---|---|
| `provider.getContext` | `(options) => WebContextPacket \| Promise<WebContextPacket>` | Supplies the current packet |
| `provider.formatContextForPrompt` | `(packet, options) => string \| Promise<string>` | Optional custom prompt formatter |
| `name` | `string` | MCP server name |
| `version` | `string` | MCP server version |

## `createAskableMcpWebHandler(options)`

Creates a stateless Streamable HTTP handler for Web Standards runtimes. Use this
for `Request -> Response` route handlers in Next.js, Vercel, Cloudflare Workers,
Bun, Deno, and Node 18+ runtimes.

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
  telemetry: (event) => {
    metrics.timing('askable.mcp.duration', event.durationMs, {
      outcome: event.outcome,
      status: event.status,
    });
  },
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

| Option | Type | Description |
|---|---|---|
| `provider` | `AskableMcpContextProvider` | Supplies packets and optional prompt formatting |
| `authorize` | `(request) => AskableMcpAuthorizeResult \| Promise<AskableMcpAuthorizeResult>` | Optional request gate before context is read |
| `cors` | `boolean \| AskableMcpCorsOptions` | Optional CORS and browser preflight handling |
| `maxRequestBodyBytes` | `number \| false` | Maximum request body size before the MCP transport parses the body. Defaults to 1 MiB |
| `responseHeaders` | `HeadersInit \| (request, response) => HeadersInit` | Optional response headers for the web endpoint |
| `telemetry` | `(event) => void \| Promise<void>` | Optional sanitized request outcome reporting |
| `transport` | `AskableMcpStatelessTransportOptions` | Optional stateless MCP transport options |
| `requestOptions` | `HandleRequestOptions \| (request) => HandleRequestOptions` | Optional per-request parsed body or auth info |
| `onError` | `(error, request) => void` | Optional setup error reporter |

When `authorize` returns `false`, the handler returns a JSON-RPC `401`. Return
a custom `Response` for app-owned auth errors, or return request options such as
`authInfo` to pass validated auth metadata to MCP handlers.

When `cors` is configured, preflight requests are answered before auth or context
reads. Web responses also receive `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff` unless the response already set those headers.

`maxRequestBodyBytes` rejects oversized MCP requests with a JSON-RPC `413`
before authorization, server setup, or MCP body parsing runs. The default is
1 MiB. Pass `false` to disable the built-in guard when another layer already
enforces request limits.

`telemetry` receives sanitized request metadata such as method, path, status,
outcome, duration, origin, user agent, and request ID. It does not include MCP
request bodies, Context packets, or prompt text.

## Tool options

`get_current_context` and `format_context_for_prompt` accept common context
options:

| Option | Description |
|---|---|
| `scope` | Filter context to a named UI scope |
| `preset` | Use `compact`, `verbose`, or `json` prompt defaults |
| `format` | Use `natural` or `json` prompt output |
| `includeText` | Include or omit target text |
| `maxTextLength` | Truncate extracted text |
| `maxTokens` | Apply an approximate prompt budget |
| `hierarchyDepth` | Limit included ancestor hierarchy |
| `history` | Include recent interactions |
| `includeViewport` | Include visible annotated elements in packets |
| `sources` | Include registered app-owned sources in packets and prompt text |
| `sourceMode` | Default source mode when a source request omits `mode` |
| `sourceErrorMode` | Use `include`, `omit`, or `throw` for failed sources |
| `intent` | Attach user intent to packets |
| `currentLabel` / `historyLabel` | Customize prompt section labels |
| `sourceLabel` | Customize the prompt section label for source context |

## Registered MCP surface

| Name | Kind | Description |
|---|---|---|
| `context://schema` | Resource | JSON Schema for packets |
| `get_current_context` | Tool | Returns the current packet as JSON |
| `get_context_schema` | Tool | Returns the packet JSON Schema |
| `format_context_for_prompt` | Tool | Returns prompt-ready text |

`createAskableMcpServer()` does not start a transport. Connect the returned
server with the MCP transport that fits your runtime, or use
`createAskableMcpWebHandler()` for Web Standards route handlers.

## Web MCP for Claude and ChatGPT

For user-owned Claude or ChatGPT clients, host the MCP server behind a public
HTTPS endpoint such as `https://your-app.com/mcp`. The app hosting that endpoint
should own authentication, rate limits, tenancy checks, and consent boundaries.

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
  telemetry: (event) => {
    metrics.timing('askable.mcp.duration', event.durationMs, {
      outcome: event.outcome,
      status: event.status,
    });
  },
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

Claude clients can connect to the URL as a remote MCP server. The Anthropic
Messages API MCP connector uses:

```json
{
  "type": "url",
  "name": "askable-context",
  "url": "https://your-app.com/mcp"
}
```

ChatGPT developer mode can create an app from a remote MCP server. OpenAI API
requests can also pass the endpoint as a remote MCP server:

```json
{
  "type": "mcp",
  "server_label": "askable",
  "server_url": "https://your-app.com/mcp"
}
```

For current client setup details, check the official
[Anthropic MCP connector docs](https://docs.anthropic.com/en/docs/agents-and-tools/mcp-connector)
and [OpenAI remote MCP docs](https://platform.openai.com/docs/guides/tools-remote-mcp).

## `createAskableMcpPageBridge(options)`

Creates the page-side handoff for browser-local MCP workflows. This is separate
from hosted Web MCP: a normal webpage cannot expose MCP directly to local Claude
or ChatGPT clients. It needs a trusted browser extension or local companion
process that can receive page context and expose its own local MCP server.

`createAskableMcpPageBridge()` listens for versioned `window.postMessage()`
requests and returns the current Context packet, prompt-ready text, or a
resource-shaped `askable://current` payload.

```ts
import { createAskableMcpContextProvider, createAskableMcpPageBridge } from '@askable-ui/mcp';

const bridge = createAskableMcpPageBridge({
  provider: createAskableMcpContextProvider(ctx, {
    history: 3,
    includeViewport: true,
    sources: ['accounts'],
  }),
  allowedOrigins: [window.location.origin],
  onError: (error) => reportBridgeError(error),
});

bridge.dispose();
```

| Option | Type | Description |
|---|---|---|
| `provider` | `AskableMcpContextProvider` | Supplies packets and optional prompt formatting |
| `channel` | `string` | Optional message channel. Defaults to `askable:mcp` |
| `targetOrigin` | `string` | Optional response target origin for `postMessage()` |
| `allowedOrigins` | `string[] \| (origin, event) => boolean` | Optional origin gate. Defaults to the current page origin |
| `window` | `AskableMcpPageBridgeWindow` | Optional window-like object for tests or custom browser surfaces |
| `onError` | `(error, event) => void` | Optional bridge error reporter |

Trusted extensions or local companions request context with:

```ts
window.postMessage({
  protocol: 'askable.mcp.page_bridge',
  version: '0.1',
  channel: 'askable:mcp',
  type: 'get_current_context',
  requestId: crypto.randomUUID(),
  options: { sources: ['accounts'], history: 3 },
}, window.location.origin);
```

Use `type: 'format_context_for_prompt'` to receive prompt-ready text.

Use `type: 'read_current_resource'` when a browser extension or local companion
wants a response that can map directly to MCP `resources/read` content:

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

The response includes:

```ts
{
  type: 'read_current_resource:result',
  resource: {
    uri: 'askable://current',
    name: 'current_context',
    title: 'Current Askable context',
    mimeType: 'application/json',
    text: '{ ...packet json... }'
  }
}
```

Set `resource.format` to `prompt` for `text/plain` prompt context, or pass a
custom `resource.uri` such as `askable://current.txt`. Responses preserve
`protocol`, `version`, `channel`, and `requestId`, and return
`get_current_context:result`, `format_context_for_prompt:result`,
`read_current_resource:result`, or `*:error` message types.

Enable this bridge only when the user or host app has opted into local browser
MCP. The extension or companion should own installation trust, user consent,
local MCP server authentication, and any storage or forwarding rules.
