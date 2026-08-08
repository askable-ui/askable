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
    getPacket: () => ctx.toContextPacket(),
    formatPrompt: () => ctx.toPromptContext(),
  },
  transports: [
    createFunctionTransport(({ payload }) => {
      console.log(payload.packet, payload.prompt, payload.question);
    }),
  ],
});
```

Methods:

| Method | Description |
|---|---|
| `send(packet, options?)` | Sends a provided `WebContextPacket` |
| `sendCurrent(options?)` | Reads the provider's current packet and sends it |
| `sendPrompt(question, options?)` | Sends current context with a user question |
| `registerTransport(transport)` | Adds a transport and returns an unregister function |
| `dispose()` | Removes all registered transports |

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
storage boundaries.

```ts
if (isAskableBridgeEnvelope(message.envelope)) {
  consume(message.envelope.payload.packet);
}
```

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

## Types

| Type | Description |
|---|---|
| `AskableBridgeEnvelope` | Versioned message sent to all transports |
| `AskableBridgePayload` | Context packet plus optional prompt and question |
| `AskableBridgeTransport` | Transport interface |
| `AskableBridgeContextProvider` | Provider for current packet and optional prompt text |
| `AskableBridgeAck` | Transport acknowledgement |
| `AskableBridgeSendOptions` | Per-send request id, source, destination, question, prompt, signal |
