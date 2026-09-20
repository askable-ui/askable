# @askable-ui/bridge

Provider-neutral transports for sending Context packets to chat surfaces,
browser extensions, local MCP companions, and webhooks.

```bash
npm install @askable-ui/bridge
```

## Constants

| Constant | Value |
|---|---|
| `ASKABLE_BRIDGE_PROTOCOL` | `askable.bridge` |
| `ASKABLE_BRIDGE_VERSION` | `0.1` |
| `ASKABLE_BRIDGE_CHANNEL` | `askable:bridge` |

## `createAskableBridge(options)`

Creates a bridge with a context provider and one or more transports.

```ts
import { createAskableBridge, createFunctionTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: {
    getPacket: () => ctx.toContextPacketAsync(),
    formatPrompt: () => ctx.toContextAsync(),
  },
  transports: [
    createFunctionTransport(({ payload }) => {
      console.log(payload.packet, payload.prompt, payload.question);
    }),
  ],
});
```

Options:

| Option | Description |
|---|---|
| `provider` | Supplies the current packet and optional prompt text. May return promises — prefer `ctx.toContextPacketAsync()` so registered context sources are included |
| `transports` | Transports to register up front. Ids must be unique; duplicates throw |
| `source` / `destination` | Defaults stamped onto every envelope |
| `requireRedacted` | Refuse packets with `privacy.redacted === false`. Defaults to `false`, matching `@askable-ui/mcp` |
| `allowedConsent` | Only send packets whose `privacy.consent` is in this list. Defaults to allowing all |
| `maxEnvelopeBytes` | Refuse envelopes larger than this once serialized. Off by default |

Methods:

| Method | Description |
|---|---|
| `send(packet, options?)` | Sends a provided `WebContextPacket` |
| `sendCurrent(options?)` | Reads the provider's current packet and sends it |
| `sendPrompt(question, options?)` | Sends current context with a user question |
| `sendAgentRequest(request, options?)` | Sends an existing `ctx.toAgentRequest()` payload without re-resolving context |
| `registerTransport(transport)` | Adds a transport and returns an unregister function. The handle removes that transport by identity, never a later one that reused the id |
| `dispose()` | Removes all transports and aborts sends still in flight |

Every send resolves with one `AskableBridgeAck` per transport, in registration
order. A transport that throws becomes an `ok: false` ack rather than discarding
the acks of transports that succeeded.

## `createAskableBridgeEnvelope(packet, options?)`

Wraps a `WebContextPacket` in the bridge envelope.

```ts
const envelope = createAskableBridgeEnvelope(packet, {
  requestId: 'req_123',
  question: 'What changed here?',
  destination: { kind: 'app-chat', label: 'Support assistant' },
});
```

## `isAskableBridgeEnvelope(value)`

Runtime guard for validating messages at iframe, extension, worker, webhook, and
storage boundaries. Checks the protocol, channel, request id, consent value, and
the nested Context packet.

```ts
if (isAskableBridgeEnvelope(message.envelope)) {
  consume(message.envelope.payload.packet);
}
```

## `isAskableBridgeVersionSupported(version)`

True when an envelope version shares the current major version. Receivers accept
the whole major line so a minor protocol bump does not break every deployed
extension and webhook at once. Compare against `ASKABLE_BRIDGE_VERSION` directly
when you need to pin an exact version.

## Transports

### `createFunctionTransport(handler, options?)`

Use for in-process chat UIs or tests.

```ts
createFunctionTransport(async ({ payload }) => {
  await sendMessage(payload.question, payload.prompt);
});
```

### `createPostMessageTransport(options?)`

Sends envelopes with `window.postMessage()`.

```ts
createPostMessageTransport({
  targetWindow: iframe.contentWindow!,
  targetOrigin: 'https://chat.example.com',
});
```

| Option | Description |
|---|---|
| `targetWindow` | Window to post to. Defaults to the current window |
| `targetOrigin` | Required for cross-origin targets. Without it the transport uses the sending page's own origin and never `'*'` |
| `allowAnyOrigin` | Opt in to `'*'`. Broadcasts the packet to any listener on any origin |
| `messageType` | Message envelope type. Defaults to `askable:bridge:context` |

### `createBrowserExtensionTransport(options?)`

Sends envelopes through `chrome.runtime.sendMessage()` or
`browser.runtime.sendMessage()`.

```ts
createBrowserExtensionTransport();
```

### `createHttpTransport(options)`

Sends envelopes to a server endpoint with `fetch()`.

```ts
createHttpTransport({
  url: '/api/askable/context',
  headers: () => ({ authorization: `Bearer ${token}` }),
});
```

`headers` accepts any `HeadersInit` — a plain object, a `Headers` instance, or an
entry array — plus a function returning one, for rotating tokens. Non-2xx
responses resolve as `ok: false` with the response body on `message` and
`response`, truncated to `maxErrorBodyChars` (512 by default).

## Types

| Type | Description |
|---|---|
| `AskableBridgeEnvelope` | Versioned message sent to all transports |
| `AskableBridgePayload` | Context packet plus optional prompt, question, and metadata |
| `AskableBridgeTransport` | Transport interface |
| `AskableBridgeContextProvider` | Provider for current packet and optional prompt text |
| `AskableBridgeAgentRequestLike` | Structural shape of `AskableAgentRequest` accepted by `sendAgentRequest()` |
| `AskableBridgeAck` | Transport acknowledgement |
| `AskableBridgeConsent` | Consent values carried on the envelope |
| `AskableBridgeSendOptions` | Per-send request id, source, destination, question, prompt, metadata, signal |
