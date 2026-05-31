# @askable-ui/mcp

MCP bridge for exposing structured web context packets to AI agents.

Host applications provide a context provider. The package registers MCP tools
that return the current packet, the packet schema, and a prompt-ready text
rendering.

```ts
import { createAskableMcpServer } from '@askable-ui/mcp';

const server = createAskableMcpServer({
  provider: {
    getContext: () => ctx.toContextPacket({ history: 3, includeViewport: true }),
  },
});
```

Transports are intentionally left to the host app so the same server factory can
be used with stdio, Streamable HTTP, or an embedded web runtime.
