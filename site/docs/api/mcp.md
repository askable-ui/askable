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
| `transport` | `AskableMcpStatelessTransportOptions` | Optional stateless MCP transport options |
| `requestOptions` | `HandleRequestOptions \| (request) => HandleRequestOptions` | Optional per-request parsed body or auth info |
| `onError` | `(error, request) => void` | Optional setup error reporter |

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

The package does not start a transport. Connect the returned server with the MCP
transport that fits your runtime.

## Web MCP for Claude and ChatGPT

For user-owned Claude or ChatGPT clients, host the MCP server behind a public
HTTPS endpoint such as `https://your-app.com/mcp`. The app hosting that endpoint
should own authentication, rate limits, tenancy checks, and consent boundaries.

```ts
import { createAskableMcpContextProvider, createAskableMcpWebHandler } from '@askable-ui/mcp';

const handler = createAskableMcpWebHandler({
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
