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
| `ctx` | `Pick<AskableContext, 'toContextPacket' \| 'toContext'>` | Source context to expose through MCP |
| `defaults` | `AskableMcpContextOptions` | Default packet and prompt options applied to every tool call |

Defaults and tool-call options are merged. Nested `source`, `privacy`, and
`provenance` metadata are merged field-by-field.

## `createAskableMcpServer(options)`

Creates an MCP server with tools/resources for reading structured Context packets.

| Option | Type | Description |
|---|---|---|
| `provider.getContext` | `(options) => WebContextPacket \| Promise<WebContextPacket>` | Supplies the current packet |
| `provider.formatContextForPrompt` | `(packet, options) => string \| Promise<string>` | Optional custom prompt formatter |
| `name` | `string` | MCP server name |
| `version` | `string` | MCP server version |

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
| `intent` | Attach user intent to packets |
| `currentLabel` / `historyLabel` | Customize prompt section labels |

## Registered MCP surface

| Name | Kind | Description |
|---|---|---|
| `context://schema` | Resource | JSON Schema for packets |
| `get_current_context` | Tool | Returns the current packet as JSON |
| `get_context_schema` | Tool | Returns the packet JSON Schema |
| `format_context_for_prompt` | Tool | Returns prompt-ready text |

The package does not start a transport. Connect the returned server with the MCP
transport that fits your runtime.
