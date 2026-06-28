# MCP Integration Guide

The `@askable-ui/mcp` package bridges the browser-captured UI context with any MCP-compatible AI client (Claude Desktop, Claude.ai, ChatGPT with extensions, custom agents).

Two deployment modes are supported:

| Mode | When to use |
|---|---|
| **Browser-local page bridge** | A browser extension or companion app reads context directly from the tab |
| **Remote WebMCP** | Your server exposes a stateless Streamable HTTP MCP endpoint that agents call over the network |

## Install

```bash
npm install @askable-ui/mcp @askable-ui/core
```

## Browser-local page bridge

The page bridge exposes a `read_current_resource` MCP tool and an `askable://current` resource. A local MCP companion (e.g. a browser extension with MCP proxy support) can call this to read the current UI context without a network round trip.

```ts
// In your app entry point (e.g. main.ts / index.ts)
import { createAskableContext } from '@askable-ui/core';
import { createAskableMcpPageBridge } from '@askable-ui/mcp';

const ctx = createAskableContext();
ctx.observe(document);

const bridge = createAskableMcpPageBridge(ctx, {
  resourceUri: 'askable://current',
  name: 'My App UI Context',
});

// The bridge installs a window message listener that local companions use.
// Call bridge.destroy() when tearing down.
```

The companion receives a resource-shaped JSON object or a prompt-ready string depending on the request format.

### Prompt-ready vs structured output

```ts
// Returns a plain string like:
// "User is focused on: metric: revenue, value: $128k, period: Q3"
bridge.promptContext();

// Returns a structured WebContextPacket for programmatic use
bridge.contextPacket();
```

## Remote WebMCP (server-side)

Expose UI context as a stateless Streamable HTTP MCP endpoint that any MCP client can connect to.

### Next.js example

```ts
// app/api/mcp/route.ts
import { createAskableMcpWebHandler } from '@askable-ui/mcp';
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();

// In production, ctx is populated by packets sent from the browser client.
// The browser calls ctx.push() or ctx.select() before the user sends a message.

const handler = createAskableMcpWebHandler({
  provider: {
    getContext: () => ctx.toContextPacketAsync(),
  },
  cors: {
    origin: ['https://claude.ai', 'https://chat.openai.com'],
  },
});

export const GET = handler;
export const POST = handler;
```

### Express example

```ts
import express from 'express';
import { createAskableMcpWebHandler } from '@askable-ui/mcp';
import { createAskableContext } from '@askable-ui/core';

const app = express();
const ctx = createAskableContext();

const handler = createAskableMcpWebHandler({
  provider: {
    getContext: () => ctx.toContextPacketAsync(),
  },
  cors: { origin: true },
});

app.all('/api/mcp', async (req, res) => {
  const webRequest = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  });
  const webResponse = await handler(webRequest);
  res.status(webResponse.status);
  webResponse.headers.forEach((v, k) => res.setHeader(k, v));
  res.send(await webResponse.text());
});
```

### Authorization

Use the `authorize` callback to validate bearer tokens or API keys:

```ts
const handler = createAskableMcpWebHandler({
  provider: { getContext: () => ctx.toContextPacketAsync() },
  authorize: async (request) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (token !== process.env.MCP_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
    // Return void / true to allow the request through
  },
  cors: {
    origin: ['https://claude.ai'],
    credentials: true,
  },
});
```

## Connecting clients

### Claude Desktop

Add your endpoint to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-app": {
      "url": "https://your-app.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SECRET"
      }
    }
  }
}
```

### Claude.ai (claude.ai/code)

In Claude.ai settings → Integrations, add the MCP server URL. Claude will call `read_current_resource` to read the current UI state whenever it needs page context.

### ChatGPT plugins / connectors

Point the ChatGPT connector at your `/api/mcp` endpoint. The MCP server exposes a `read_current_resource` tool that ChatGPT's function-calling layer will invoke.

## Connect over stdio (CLI)

Some MCP clients launch a **command over stdio** instead of connecting to a URL. The `@askable-ui/mcp` package ships an `askable-mcp` binary for exactly this — no server framework or extra dependencies required. Point it at any endpoint that returns the current Context packet as JSON:

```json
{
  "mcpServers": {
    "my-app": {
      "command": "npx",
      "args": [
        "-y", "@askable-ui/mcp",
        "--url", "http://localhost:3001/context",
        "--header", "Authorization: Bearer YOUR_SECRET"
      ]
    }
  }
}
```

Your app just needs to expose a `GET` endpoint that returns the latest packet (e.g. via `ctx.toContextPacket()`). Flags:

| Flag | Description |
|---|---|
| `--url <endpoint>` | HTTP(S) endpoint returning the current Context packet as JSON |
| `--file <path>` | Serve a static packet file instead of fetching a URL |
| `--header "K: V"` | Extra request header for `--url` (repeatable) |
| `--name <name>` | Server name advertised to the client |
| `--require-redacted` | Refuse to serve packets with `privacy.redacted === false` |

The same remote provider is available programmatically via `createAskableMcpRemoteProvider({ url, headers })`, which you can pass to `createAskableMcpServer`.

## MCP tools exposed

The MCP server exposes a single tool:

| Tool | Description |
|---|---|
| `read_current_resource` | Returns the current UI context as a `WebContextPacket` or prompt string |

And a resource:

| Resource | URI | Description |
|---|---|---|
| Current context | `askable://current` | Structured JSON packet of the focused UI element and active sources |

## createAskableMcpServer (embedding MCP in-process)

If you want to embed an MCP server directly inside your Node.js process (e.g. for a CLI tool or Electron app):

```ts
import { createAskableMcpServer } from '@askable-ui/mcp';
import { createAskableContext } from '@askable-ui/core';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const ctx = createAskableContext();

const server = createAskableMcpServer({
  name: 'my-app-context',
  version: '1.0.0',
  provider: {
    getContext: () => ctx.toContextPacketAsync(),
  },
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Validating agent requests

When your server receives requests from AI agents that include a serialized context packet, use `isAskableAgentRequest` to validate and unwrap them:

```ts
import { isAskableAgentRequest } from '@askable-ui/core';

app.post('/api/chat', async (req, res) => {
  const body = req.body;

  if (isAskableAgentRequest(body)) {
    const { question, packet, sources } = body;
    // packet is a validated WebContextPacket
    // sources contains per-source context
    const context = packet ? JSON.stringify(packet) : body.context;
    // ... pass to your LLM
  }
});
```

## React example with page bridge

```tsx
import { useEffect } from 'react';
import { useAskable } from '@askable-ui/react';
import { createAskableMcpPageBridge } from '@askable-ui/mcp';

function App() {
  const { ctx } = useAskable();

  useEffect(() => {
    const bridge = createAskableMcpPageBridge(ctx, {
      resourceUri: 'askable://current',
    });
    return () => bridge.destroy();
  }, [ctx]);

  return <Dashboard />;
}
```
