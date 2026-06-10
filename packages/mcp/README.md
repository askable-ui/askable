# @askable-ui/mcp

MCP bridge for exposing structured Context packets to AI agents.

Host applications provide a context provider. The package registers MCP tools
that return the current packet, the packet schema, and a prompt-ready text
rendering.

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

The built-in provider adapts `ctx.toContextPacket()` and `ctx.toContext()` to
the MCP tools. When available, it uses `ctx.toContextPacketAsync()` and
`ctx.toContextAsync()` so registered app-owned sources are included in
structured packets and prompt renderings. Tool callers can request prompt
shaping options such as `scope`, `preset`, `format`, `includeText`,
`maxTextLength`, `maxTokens`, `history`, `includeViewport`, and `sources`.

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

const server = createAskableMcpServer({
  provider: createAskableMcpContextProvider(ctx, {
    history: 3,
    includeViewport: true,
    sources: [{ id: 'accounts', mode: 'all', maxItems: 25, timeoutMs: 750 }],
    sourceErrorMode: 'include',
  }),
});
```

Use `createAskableMcpServer()` when you want to attach your own MCP transport.
For web runtimes, `createAskableMcpWebHandler()` creates a stateless Streamable
HTTP `Request -> Response` handler.

## Web MCP for Claude and ChatGPT

To make Askable context available to user-owned Claude or ChatGPT clients, host
the MCP server behind a public HTTPS endpoint such as `https://your-app.com/mcp`.
Keep authentication, rate limits, tenancy checks, and consent handling in the
host app.

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

`authorize` runs before context is read. Return `false` for the built-in `401`
JSON-RPC response, return a custom `Response` when the host app owns the error
shape, or return MCP request options such as `authInfo`.

`cors` handles browser preflight requests before context is read. Web responses
also receive `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`
unless the response already set those headers.

`maxRequestBodyBytes` rejects oversized MCP requests with a JSON-RPC `413`
before authorization, server setup, or MCP body parsing runs. The default is
1 MiB. Pass `false` to disable the built-in guard when another layer already
enforces request limits.

`telemetry` receives sanitized request metadata such as method, path, status,
outcome, duration, origin, user agent, and request ID. It does not include MCP
request bodies, Context packets, or prompt text.

Claude clients can connect to the public MCP URL as a remote MCP server. The
Anthropic Messages API MCP connector uses an object like:

```json
{
  "type": "url",
  "name": "askable-context",
  "url": "https://your-app.com/mcp"
}
```

ChatGPT developer mode can create an app from a remote MCP server. OpenAI API
calls can also pass the same endpoint as a remote MCP server:

```json
{
  "type": "mcp",
  "server_label": "askable",
  "server_url": "https://your-app.com/mcp"
}
```

## Browser-local MCP bridge

Hosted Web MCP is the server-side path. For local browser workflows, a page
cannot expose MCP directly to Claude or ChatGPT by itself. It needs a trusted
browser extension or local companion process. `createAskableMcpPageBridge()`
adds the page-side handoff: the page listens for approved bridge requests and
returns the current packet, prompt-ready text, or a resource-shaped
`askable://current` payload through `window.postMessage()`. The extension or
companion can then expose that data through its own local MCP server.

```ts
import { createAskableMcpContextProvider, createAskableMcpPageBridge } from '@askable-ui/mcp';

const bridge = createAskableMcpPageBridge({
  provider: createAskableMcpContextProvider(ctx, {
    history: 3,
    includeViewport: true,
    sources: ['accounts'],
  }),
  allowedOrigins: [window.location.origin],
  onError: (error) => console.error(error),
});

// Later, when the page no longer wants to expose context:
bridge.dispose();
```

A trusted extension or local bridge can request context with the versioned
message shape:

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

Use `type: 'format_context_for_prompt'` when the bridge needs prompt-ready text
instead of the structured packet.

Use `type: 'read_current_resource'` when the extension or companion wants a
resource-shaped response that can map directly to MCP `resources/read` output:

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

Set `resource.format` to `prompt` to receive `text/plain` prompt context at a
URI such as `askable://current.txt`. Keep user consent and installation trust in
the extension or companion, and enable the page bridge only when the app wants
to participate in local browser MCP workflows.
