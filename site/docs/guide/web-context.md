# Web Context Packets

Prompt strings are useful for simple chat integrations. Web context packets are
for agents, MCP bridges, browser extensions, and tools that need structured
context instead of prose.

```ts
const packet = ctx.toContextPacket({
  history: 3,
  includeViewport: true,
  source: { app: 'analytics-dashboard' },
});
```

The packet describes:

- where the context came from: URL, title, app, route, timestamp
- how the context was captured: focused element, semantic push, viewport, region, lasso, circle, or custom capture
- what the user is pointing at: text, role, label, selector, bounds, metadata, optional screenshots
- surrounding context: ancestors, visible items, and recent interactions
- privacy and provenance: redaction state, consent state, producer, and capture method

## Why packets?

`toPromptContext()` optimizes for copy-paste simplicity:

```ts
ctx.toPromptContext();
// "User is focused on: — metric: revenue — value \"Revenue\""
```

`toContextPacket()` optimizes for interoperability:

```json
{
  "protocol": "askable.web-context",
  "version": "0.1",
  "capture": { "mode": "element-focus", "gesture": "focus" },
  "target": {
    "text": "Revenue",
    "metadata": { "metric": "revenue", "value": "$2.3M" }
  },
  "privacy": { "redacted": false, "consent": "implicit" },
  "provenance": { "producer": "@askable-ui/core", "method": "app" }
}
```

Use packets when the receiving system should validate, store, transform, or
route context before sending it to a model.

## MCP bridge

`@askable-ui/mcp` exposes packets through MCP tools and resources. The host
application provides a context provider:

```ts
import { createAskableMcpServer } from '@askable-ui/mcp';

const server = createAskableMcpServer({
  provider: {
    getContext: (options) => ctx.toContextPacket(options),
  },
});
```

The server registers:

| Name | Kind | Purpose |
|---|---|---|
| `web-context://schema` | Resource | JSON Schema for web context packets |
| `get_current_context` | Tool | Returns the current structured packet |
| `get_context_schema` | Tool | Returns the packet schema |
| `format_context_for_prompt` | Tool | Returns a prompt-ready rendering |

The MCP package does not choose a transport. Use the returned MCP server with
stdio, Streamable HTTP, or an embedded runtime depending on where context is
captured.

## Privacy

Packets reflect the same sanitizers as prompt serialization:

```ts
const ctx = createAskableContext({
  sanitizeMeta: ({ ssn, ...safe }) => safe,
  sanitizeText: (text) => text.replace(/\b\d{16}\b/g, '[card]'),
});

ctx.toContextPacket().privacy.redacted;
// true
```

Set explicit consent/provenance metadata when context is captured from browser
extensions, region selection, or user-triggered actions:

```ts
ctx.toContextPacket({
  privacy: { consent: 'explicit' },
  provenance: { producer: 'my-browser-extension', method: 'extension' },
});
```
