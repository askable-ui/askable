# Bridge Context to Chat

`@askable-ui/bridge` sends the current Context packet to wherever the user wants
to ask a question: an in-app chat panel, an iframe, a browser extension, a local
MCP companion, or a server endpoint.

Use it when the chat surface is not the same code path that captured the
context.

## Install

```bash
npm install @askable-ui/bridge @askable-ui/core
```

## In-app chat

```ts
import { createAskableContext } from '@askable-ui/core';
import { createAskableBridge, createFunctionTransport } from '@askable-ui/bridge';

const ctx = createAskableContext();
ctx.observe(document);

const bridge = createAskableBridge({
  provider: {
    getPacket: () => ctx.toContextPacketAsync({ history: 3, includeViewport: true }),
    formatPrompt: () => ctx.toContextAsync(),
  },
  transports: [
    createFunctionTransport(async ({ payload }) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: payload.question,
          context: payload.prompt,
          packet: payload.packet,
        }),
      });
      if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
    }),
  ],
});

await bridge.sendPrompt('Explain this selected account.');
```

::: tip Use the async packet methods
`getPacket` accepts a promise, so prefer `toContextPacketAsync()` over
`toContextPacket()`. Only the async form resolves context sources registered
with `ctx.registerSource()` into `surrounding.sources` — the synchronous method
silently omits them, so the bridge would send a thinner packet than the same app
exposes over MCP.
:::

## Browser extension handoff

A browser extension can receive Askable context without the host app knowing
which chatbot the user prefers.

```ts
import { createAskableBridge, createBrowserExtensionTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacketAsync() },
  transports: [createBrowserExtensionTransport()],
});

await bridge.sendCurrent({
  destination: { kind: 'browser-extension', label: 'Local assistant' },
});
```

In the extension:

```ts
import { isAskableBridgeEnvelope } from '@askable-ui/bridge';

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'askable:bridge:context') return;
  if (!isAskableBridgeEnvelope(message.envelope)) return;

  const packet = message.envelope.payload.packet;
  // Forward packet to a side panel, local app, or MCP companion.
});
```

For a complete Manifest V3 extension, see the
[Browser Extension Companion example](/examples/browser-extension). It captures
selected text, the last focused DOM element, or bounded full-page context from
any normal web page, then sends the same bridge envelope to the extension
background worker.

## Iframe or same-window bridge

Use `postMessage` when a chat surface is embedded in an iframe or a sibling
window.

```ts
import { createAskableBridge, createPostMessageTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacketAsync() },
  transports: [
    createPostMessageTransport({
      targetWindow: chatFrame.contentWindow!,
      targetOrigin: 'https://chat.example.com',
    }),
  ],
});
```

::: warning Always name the target origin
Context packets are never broadcast to `'*'`. When `targetOrigin` is omitted the
transport falls back to the sending page's own origin, which means a
cross-origin iframe receives nothing until you name its origin. If you genuinely
want every origin to read the packet, opt in with `allowAnyOrigin: true`.
:::

## Privacy gates

The bridge is the point where context leaves the page, so it can refuse to send
packets that fall short of your policy. Both checks run before any transport is
touched and throw rather than sending.

```ts
const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacketAsync() },
  requireRedacted: true,          // refuse packets with privacy.redacted === false
  allowedConsent: ['explicit'],   // refuse anything not explicitly consented
  maxEnvelopeBytes: 512 * 1024,   // refuse oversized envelopes (screenshots are base64)
  transports: [createHttpTransport({ url: '/api/askable/context' })],
});
```

`ctx.toContextPacket()` only reports `redacted: true` when a `sanitizeMeta` or
`sanitizeText` function is registered on the context, and stamps
`consent: 'implicit'` unless the capture overrides it. Set the packet's
`privacy` explicitly on capture if you plan to gate on `allowedConsent`.

## Sending an existing agent request

Apps already using `ctx.toAgentRequest()` do not need to resolve context twice.
`sendAgentRequest()` maps the request onto the envelope directly — `question`,
`context` (as `payload.prompt`), `packet`, `metadata`, and `requestId`.

```ts
const request = await ctx.toAgentRequest('Why did this account churn?', {
  packet: true,
  metadata: { surface: 'cmd-k' },
});

await bridge.sendAgentRequest(request);
```

When the request carries no `packet`, the bridge falls back to the configured
provider.

For a review-before-send flow, include a packet and detach a JSON snapshot
**before showing it for approval**. Review the question, prompt, packet,
metadata, and any conversation history your handler sends, not just the visible
selection. Do not mutate the approved snapshot or override its payload fields
in `sendAgentRequest()` options. Without a packet, the provider fallback may
read different context after approval.

`destination` is envelope metadata, not a transport selector. Every registered
transport receives each send. Use a bridge with only the user-approved
transport when building a destination picker.

## Webhook or backend handoff

```ts
import { createAskableBridge, createHttpTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: {
    getPacket: () => ctx.toContextPacket(),
    formatPrompt: () => ctx.toPromptContext(),
  },
  transports: [
    createHttpTransport({
      url: '/api/askable/context',
      headers: () => ({ authorization: `Bearer ${sessionToken}` }),
    }),
  ],
});
```

## Acks and partial failure

Every send resolves with one ack per transport, in registration order. A
transport that throws becomes an `ok: false` ack — it never discards the acks of
the transports that succeeded.

```ts
const acks = await bridge.sendPrompt('Summarize this account.');

for (const ack of acks) {
  if (!ack.ok) reportBridgeFailure(ack.transportId, ack.message);
}
```

`ok: true` means the transport dispatched the envelope without throwing, not
that a receiver consumed it. `postMessage`, function, and extension transports
all report success even when nothing is listening; only the HTTP transport
observes a real response from the other side.

Label this state **dispatched**, not **acknowledged**. Show acknowledgement only
after validating an application receipt tied to the request ID and expected
receiver. HTTP 2xx or an arbitrary function result is not such a receipt.
Cancelling after dispatch can leave delivery unknown. Retrying the whole bridge
resends to successful transports too, and a stable request ID does not by itself
deduplicate requests at the receiver.

Register more than one transport of the same kind by giving each an explicit
`id` — duplicate ids throw at registration instead of silently replacing the
earlier transport.

```ts
transports: [
  createHttpTransport({ id: 'chat', url: '/api/askable/context' }),
  createHttpTransport({ id: 'audit', url: 'https://audit.internal/context' }),
]
```

## Bridge vs MCP

| Need | Use |
|---|---|
| Send context into your own chat UI, extension, iframe, or webhook | `@askable-ui/bridge` |
| Expose context as MCP tools and resources for Claude, ChatGPT connectors, Cursor, or local clients | `@askable-ui/mcp` |
| Define or validate the open packet format | `@askable-ui/context` |

Most browser-local MCP setups use both packages: `@askable-ui/bridge` moves the
packet out of the page, and `@askable-ui/mcp` exposes that packet to the local
MCP client.

## Envelope

Every transport receives the same versioned envelope:

```ts
{
  protocol: 'askable.bridge',
  version: '0.1',
  channel: 'askable:bridge',
  requestId: '...',
  timestamp: '...',
  consent: 'explicit',
  payload: {
    packet,
    prompt: 'Prompt-ready context',
    question: 'What should I do next?',
    metadata: { surface: 'cmd-k' }
  }
}
```

Use `isAskableBridgeEnvelope(value)` before trusting messages from extensions,
iframes, workers, storage, or webhooks. The guard validates the protocol,
channel, request id, consent value, and the nested packet.

Receivers accept any envelope from the same major version, so a minor protocol
bump does not break every deployed extension and webhook at once. Call
`isAskableBridgeVersionSupported(version)` yourself, or compare against
`ASKABLE_BRIDGE_VERSION` directly, when you need to pin an exact version.
