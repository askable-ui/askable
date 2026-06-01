# @askable-ui/context

Shared packet types and schema for structured Context packets.

The open specification lives at [askable-ui/context-standard](https://github.com/askable-ui/context-standard).

```bash
npm install @askable-ui/context
```

```ts
import {
  WEB_CONTEXT_PROTOCOL,
  WEB_CONTEXT_VERSION,
  createWebContextPacket,
  isWebContextPacket,
  webContextPacketSchema,
} from '@askable-ui/context';
```

## `createWebContextPacket(options)`

Creates a versioned packet with default source timestamp, privacy, and
provenance fields.

```ts
const packet = createWebContextPacket({
  capture: { mode: 'element-focus', gesture: 'click' },
  target: {
    text: 'Revenue',
    metadata: { metric: 'revenue', value: '$2.3M' },
  },
});
```

## `isWebContextPacket(value)`

Runtime guard for checking whether an unknown value matches the supported
packet envelope.

```ts
if (isWebContextPacket(value)) {
  console.log(value.capture.mode);
}
```

## `webContextPacketSchema`

JSON Schema for validating packets at MCP, HTTP, browser-extension, or storage
boundaries.

```ts
JSON.stringify(webContextPacketSchema, null, 2);
```

## Packet fields

| Field | Description |
|---|---|
| `protocol` | Stable protocol identifier, currently `askable.context` |
| `version` | Packet version, currently `0.1` |
| `source` | URL, title, app, route, and timestamp |
| `capture` | Capture mode, gesture, and optional user intent |
| `target` | Text, label, role, selector, bounds, metadata, and screenshot |
| `surrounding` | Ancestors, nearby items, visible items, history, and app-owned sources |
| `privacy` | Redaction and consent metadata |
| `provenance` | Producer and capture method |
