# What’s New in v0.9.0

askable-ui v0.9.0 makes the MCP bridge easier to wire into agent runtimes by
adding a first-class provider for existing Askable contexts.

## Highlights

### First-class MCP context provider

`@askable-ui/mcp` now exports `createAskableMcpContextProvider()` so apps can
publish the same context they already use in their UI directly through MCP
tools and resources.

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

The provider adapts `ctx.toContextPacket()` for structured packet tools and
`ctx.toContext()` for prompt-ready text tools. Callers can request prompt
shaping options such as `scope`, `preset`, `format`, `includeText`,
`maxTextLength`, `maxTokens`, `history`, and `includeViewport`.

Related docs:

- [Context Packets](/guide/context)
- [@askable-ui/mcp API](/api/mcp)

### Expanded MCP prompt controls

The MCP bridge now accepts the same common prompt controls as the core context
serializer, so MCP clients can ask for compact, JSON, scoped, or text-limited
context without each host app inventing its own tool contract.

### Starter and docs version alignment

`npm create @askable-ui/app` now scaffolds projects pinned to `^0.9.0`, and the
versioned docs have been advanced to `/docs/v0.9.0/`.

## Recommended next step

If you are integrating Askable into an AI or agent runtime, start here:

1. [Getting Started](/guide/getting-started)
2. [Context Packets](/guide/context)
3. [@askable-ui/mcp API](/api/mcp)

## Version note

The current published docs track **v0.9.0** at both:

- `/docs/`
- `/docs/v0.9.0/`
