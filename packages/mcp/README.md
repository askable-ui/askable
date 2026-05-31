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
the MCP tools. Tool callers can request prompt shaping options such as `scope`,
`preset`, `format`, `includeText`, `maxTextLength`, `maxTokens`, `history`, and
`includeViewport`.

Transports are intentionally left to the host app so the same server factory can
be used with stdio, Streamable HTTP, or an embedded web runtime.
