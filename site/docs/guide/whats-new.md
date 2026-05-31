# What’s New in v0.7.1

askable-ui v0.7.1 aligns the structured Context packet identity with the new open spec repo.

## Highlights

### Structured Context packets

`@askable-ui/core` now emits versioned Context packets:

```ts
const packet = ctx.toContextPacket({
  history: 3,
  includeViewport: true,
  source: { app: 'analytics-dashboard' },
});
```

Packets preserve the same annotated metadata used by prompt serialization, but
add source, capture, surrounding context, privacy, and provenance fields.

Use packets when you want to:

- pass selected/focused UI context through MCP
- store or validate context before forwarding it to a model
- bridge app-authored context into browser extensions or agent runtimes
- include viewport and history context without flattening everything to prose

Related docs:

- [Context Packets](/guide/context)
- [@askable-ui/core API](/api/core)

### New `@askable-ui/context` package

The new context package provides the shared packet contract:

```ts
import {
  createWebContextPacket,
  isWebContextPacket,
  webContextPacketSchema,
} from '@askable-ui/context';
```

It is dependency-free and backed by the public [askable-ui/context](https://github.com/askable-ui/context) spec repo. It can be used by non-React runtimes, browser bridges,
servers, or storage pipelines that need to understand the same packet shape.

### New `@askable-ui/mcp` package

`@askable-ui/mcp` creates an MCP server surface around a context provider:

```ts
const server = createAskableMcpServer({
  provider: {
    getContext: (options) => ctx.toContextPacket(options),
  },
});
```

The server registers tools for reading the current context, reading the schema,
and formatting a packet for prompts. Transports are left to the host app so this
can work with stdio, Streamable HTTP, or embedded browser runtimes.

### 0.7 release path

All workspace packages have been bumped to `0.7.1`, and the publish workflow now
publishes packages in dependency order:

1. `@askable-ui/context`
2. `@askable-ui/core`
3. framework wrappers
4. `@askable-ui/mcp`
5. `@askable-ui/create-app`

## Recommended next step

If you are integrating Askable into an AI or agent runtime, start here:

1. [Getting Started](/guide/getting-started)
2. [Context Packets](/guide/context)
3. [@askable-ui/mcp API](/api/mcp)

## Version note

The current published docs track **v0.7.1** at both:

- `/docs/`
- `/docs/v0.7.1/`
