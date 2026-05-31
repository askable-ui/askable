# What’s New in v0.8.0

askable-ui v0.8.0 adds explicit region and circle capture for "send this part
of the page" agent workflows.

## Highlights

### Region and circle capture

`@askable-ui/core` now exports `createAskableRegionCapture()`:

```ts
const capture = createAskableRegionCapture(ctx, {
  shape: 'circle',
  intent: 'explain this selected area',
  includeViewport: true,
  onCapture: (packet) => sendToAgent(packet),
});

capture.start();
```

The helper mounts a temporary drag overlay and emits a Context packet with
`capture.mode` set to `region` or `circle`, explicit consent metadata, and the
selected geometry in `target.bounds`.

Use it when you want to:

- let a user circle part of a chart, table, or canvas
- send a visible page region to an agent
- combine manual selection geometry with viewport and focus context
- build screenshot or browser-extension capture flows on top of the same packet shape

Related docs:

- [Context Packets](/guide/context)
- [@askable-ui/core API](/api/core)

### Packet target overrides

`ctx.toContextPacket()` now accepts an explicit `target`, so custom capture
tools can set bounds or metadata without pretending the current DOM focus is the
selected object.

```ts
ctx.toContextPacket({
  mode: 'region',
  gesture: 'drag',
  target: {
    bounds: { x: 24, y: 48, width: 320, height: 180 },
    metadata: { shape: 'region' },
  },
});
```

### Existing Context package

`@askable-ui/context` continues to provide the shared packet contract:

```ts
import {
  createWebContextPacket,
  isWebContextPacket,
  webContextPacketSchema,
} from '@askable-ui/context';
```

It is dependency-free and backed by the public [askable-ui/context](https://github.com/askable-ui/context) spec repo. It can be used by non-React runtimes, browser bridges,
servers, or storage pipelines that need to understand the same packet shape.

### MCP bridge

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

### 0.8 release path

All workspace packages have been bumped to `0.8.0`, and the publish workflow now
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

The current published docs track **v0.8.0** at both:

- `/docs/`
- `/docs/v0.8.0/`
