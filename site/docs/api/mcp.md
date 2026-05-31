# @askable-ui/mcp

MCP bridge for exposing web context packets to agents.

```bash
npm install @askable-ui/mcp
```

```ts
import { createAskableMcpServer } from '@askable-ui/mcp';

const server = createAskableMcpServer({
  provider: {
    getContext: (options) => ctx.toContextPacket(options),
  },
});
```

## `createAskableMcpServer(options)`

Creates an MCP server with tools/resources for reading structured web context.

| Option | Type | Description |
|---|---|---|
| `provider.getContext` | `(options) => WebContextPacket \| Promise<WebContextPacket>` | Supplies the current packet |
| `provider.formatContextForPrompt` | `(packet) => string \| Promise<string>` | Optional custom prompt formatter |
| `name` | `string` | MCP server name |
| `version` | `string` | MCP server version |

## Registered MCP surface

| Name | Kind | Description |
|---|---|---|
| `web-context://schema` | Resource | JSON Schema for packets |
| `get_current_context` | Tool | Returns the current packet as JSON |
| `get_context_schema` | Tool | Returns the packet JSON Schema |
| `format_context_for_prompt` | Tool | Returns prompt-ready text |

The package does not start a transport. Connect the returned server with the MCP
transport that fits your runtime.
