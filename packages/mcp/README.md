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
