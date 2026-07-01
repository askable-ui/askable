# The Context Packet Protocol

**`askable.context` · version `0.1` · status: draft**

The Context Packet is an open, versioned wire format for telling an AI **what a user is looking at**. It is deliberately small: one JSON object that carries where the context came from, how it was captured, what was captured, and — first-class, not bolted on — the privacy and provenance facts an agent needs before it may use the data.

askable-ui is the reference implementation, but nothing in the format is specific to it. Any producer (a web app, a browser extension, a native app, a design tool) can emit packets, and any consumer (an LLM prompt builder, an MCP client, an agent runtime) can read them. If you build either, we'd like to hear about it.

## Design goals

1. **Structured, not screenshots.** Agents get the user's actual data — labels, values, geometry — at a fraction of the tokens of a DOM dump or an image.
2. **Capture-agnostic.** A click, a text highlight, a lasso around a chart, and a programmatic push all serialize to the same shape.
3. **Privacy is in the envelope.** Every packet states whether it was redacted and under what consent — so gatekeeping (like `requireRedacted` in the MCP server) is possible at the protocol level.
4. **Boring to parse.** Plain JSON, a published JSON Schema, and a tiny runtime guard.

## The packet

```json
{
  "protocol": "askable.context",
  "version": "0.1",
  "source": {
    "url": "https://app.example/dashboard",
    "title": "Analytics Dashboard",
    "app": "acme-analytics",
    "timestamp": "2026-06-29T04:20:00.000Z"
  },
  "capture": {
    "mode": "lasso",
    "gesture": "drag",
    "intent": "explain the highlighted region"
  },
  "target": {
    "text": "NRR 118% (+6pp QoQ)",
    "role": "figure",
    "metadata": { "metric": "net revenue retention", "value": "118%" },
    "bounds": { "x": 120, "y": 240, "width": 420, "height": 260 }
  },
  "surrounding": {
    "visible": [{ "metadata": { "metric": "pipeline coverage", "value": "3.9x" } }],
    "history": [{ "metadata": { "metric": "support backlog" } }],
    "sources": [{ "label": "orders", "role": "collection", "metadata": { "total": 12 } }]
  },
  "privacy": { "redacted": true, "consent": "explicit" },
  "provenance": { "producer": "askable-ui", "method": "app" }
}
```

## Fields

### Envelope

| Field | Required | Description |
|---|---|---|
| `protocol` | ✔ | Always `"askable.context"`. |
| `version` | ✔ | Format version. Currently `"0.1"`. |
| `source` | ✔ | Where the packet came from: `url`, `title`, `app`, `route`, and a required `timestamp` (ISO 8601). |
| `capture` | ✔ | How it was captured (below). |
| `target` | — | The primary thing the user pointed at (below). |
| `surrounding` | — | Context around the target (below). |
| `privacy` | ✔ | Redaction and consent facts (below). |
| `provenance` | ✔ | Who produced the packet and by what method (below). |

### `capture`

| Field | Required | Values |
|---|---|---|
| `mode` | ✔ | `text-selection` · `element-focus` · `viewport` · `full-page` · `region` · `lasso` · `circle` · `semantic` · `custom` |
| `gesture` | — | `click` · `hover` · `focus` · `keyboard` · `drag` · `circle` · `lasso` · `programmatic` · `custom` |
| `intent` | — | Free-text user intent, e.g. `"explain this region"`. |

### `target` (and every entry in `surrounding`)

A **target** describes one captured thing:

| Field | Description |
|---|---|
| `text` | The visible or accessible text. |
| `role` | Semantic role (`figure`, `table`, `button`, a collection name, …). |
| `label` | Human-readable label. |
| `selector` | CSS selector or equivalent locator. |
| `bounds` | `{ x, y, width, height }` in CSS pixels. |
| `metadata` | The structured app data — the `data-askable` payload. Object or string. |
| `screenshot` | Optional image: `{ mimeType, data?, url? }` (`image/png`, `image/jpeg`, `image/webp`). |

### `surrounding`

All optional arrays of targets: `ancestors` (containment chain), `nearby`, `visible` (in viewport), `history` (recent focuses), and `sources` (app-owned data sources — carts, tables, form state — see [Custom Sources](/guide/sources)).

### `privacy`

| Field | Required | Values |
|---|---|---|
| `redacted` | ✔ | Whether sanitization ran over this packet. Consumers **should** refuse unredacted packets in sensitive contexts — the askable-ui MCP server and page bridge do this when `requireRedacted` is set. |
| `consent` | ✔ | `explicit` (the user actively sent this) · `implicit` (ambient capture) · `none` |
| `omitted` | — | Names of fields that were removed during redaction. |

### `provenance`

| Field | Required | Values |
|---|---|---|
| `producer` | ✔ | Name of the producing library or app. |
| `method` | ✔ | `app` · `dom` · `extension` · `mcp` · `manual` |

## Schema and validation

The normative JSON Schema is published as `webContextPacketSchema` in [`@askable-ui/context`](/api/context) — a dependency-free package containing only the types, the schema, and two functions:

```ts
import {
  webContextPacketSchema,   // JSON Schema (draft 2020-12)
  createWebContextPacket,   // producer helper with sane defaults
  isWebContextPacket,       // runtime guard — enum-validating, schema-aligned
} from '@askable-ui/context';

if (isWebContextPacket(incoming)) {
  // incoming is a valid WebContextPacket
}
```

The guard's enum sets are read from the schema at module load, so the two cannot drift. MCP clients can also fetch the schema live from any askable MCP server at the `context://schema` resource.

## Versioning

`version` follows the format, not the library. Additive optional fields do not bump the version; changes to required fields or enum semantics do. Consumers should accept unknown optional fields and reject unknown `protocol`/`version` values.

## Producing packets

Any code can emit a packet — the helper just fills the envelope:

```ts
import { createWebContextPacket } from '@askable-ui/context';

const packet = createWebContextPacket({
  source: { app: 'my-app', url: location.href },
  capture: { mode: 'element-focus', gesture: 'click' },
  target: { text: 'NRR 118%', metadata: { metric: 'nrr', value: '118%' } },
  privacy: { redacted: true, consent: 'explicit' },
});
```

In askable-ui, `ctx.toContextPacket()` / `ctx.toContextPacketAsync()` produce packets from live UI state; every [capture mode](/guide/capture) emits them; and [`@askable-ui/mcp`](/guide/mcp) transports them to agents.

## Consuming packets

Validate with `isWebContextPacket`, honor `privacy` before use, then either read the structure directly or flatten to prompt text (the MCP package ships `defaultPromptFormatter`). For agent runtimes, the [MCP integration](/guide/mcp) exposes packets as the `askable://current` resource and the `get_current_context` / `format_context_for_prompt` / `list_context_sources` tools.

## Relationship to other pages

- [Context Packets guide](/guide/context) — practical usage inside askable-ui apps.
- [`@askable-ui/context` API](/api/context) — the types package.
- [MCP Integration](/guide/mcp) — transporting packets to Claude Desktop, Cursor, and any MCP client.
