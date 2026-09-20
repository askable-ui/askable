# @askable-ui/bridge

Provider-neutral bridge for sending Askable context to chat surfaces, browser
extensions, local MCP companions, and webhooks.

```bash
npm install @askable-ui/bridge @askable-ui/context
```

## Why this package exists

`@askable-ui/context` defines the packet. `@askable-ui/core` captures it.
`@askable-ui/mcp` exposes it as MCP tools and resources.

`@askable-ui/bridge` is the transport layer between those packets and the place
the user wants to ask a question. It does not depend on React, MCP, or a
specific chatbot provider.

## Send context to an in-app chat

```ts
import { createAskableBridge, createFunctionTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: {
    getPacket: () => ctx.toContextPacketAsync(),
    formatPrompt: () => ctx.toContextAsync(),
  },
  transports: [
    createFunctionTransport(async ({ payload }) => {
      await sendChatMessage({
        question: payload.question,
        context: payload.prompt,
        packet: payload.packet,
      });
    }),
  ],
});

await bridge.sendPrompt('Why did this account churn?');
```

`getPacket` may return a promise. Prefer `toContextPacketAsync()` — only the
async form resolves sources registered with `ctx.registerSource()` into
`surrounding.sources`.

Already building requests with `ctx.toAgentRequest()`? Send them straight
through, without resolving context a second time:

```ts
const request = await ctx.toAgentRequest('Why did this account churn?', { packet: true });
await bridge.sendAgentRequest(request);
```

## Send context to a browser extension

```ts
import { createAskableBridge, createBrowserExtensionTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacketAsync() },
  transports: [createBrowserExtensionTransport()],
});

await bridge.sendCurrent({
  destination: { kind: 'browser-extension', label: 'Local AI companion' },
});
```

The extension receives a message with a versioned `AskableBridgeEnvelope`:

```ts
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'askable:bridge:context') return;
  if (!isAskableBridgeEnvelope(message.envelope)) return;
  console.log(message.envelope.payload.packet);
});
```

## Send context over `postMessage`

```ts
import { createAskableBridge, createPostMessageTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacketAsync() },
  transports: [
    createPostMessageTransport({
      targetOrigin: 'https://chat.example.com',
      targetWindow: iframe.contentWindow!,
    }),
  ],
});
```

Context packets are never broadcast to `'*'`. Without `targetOrigin` the
transport falls back to the sending page's own origin, so cross-origin targets
must be named explicitly. Pass `allowAnyOrigin: true` only when the packet
carries nothing private.

## Send context to an HTTP endpoint

```ts
import { createAskableBridge, createHttpTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacketAsync() },
  transports: [
    createHttpTransport({
      url: '/api/askable/context',
      headers: () => ({ authorization: `Bearer ${sessionToken}` }),
    }),
  ],
});
```

## Privacy gates

The bridge is where context leaves the page, so it can refuse to send packets
that fall short of your policy. Both checks run before any transport is touched.

```ts
const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacketAsync() },
  requireRedacted: true,
  allowedConsent: ['explicit'],
  maxEnvelopeBytes: 512 * 1024,
  transports: [createHttpTransport({ url: '/api/askable/context' })],
});
```

## Acks

Each send resolves with one ack per transport, in registration order. A
transport that throws becomes an `ok: false` ack instead of discarding the acks
of the transports that succeeded.

`ok: true` means the envelope was dispatched without error — not that a receiver
consumed it. Only the HTTP transport sees a real response from the other side.

Give each transport an explicit `id` when registering more than one of the same
kind; duplicate ids throw instead of silently replacing the earlier transport.

## Envelope shape

Every transport receives the same envelope:

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

Use `isAskableBridgeEnvelope(value)` at extension, iframe, worker, webhook, and
storage boundaries before trusting the payload. It validates the protocol,
channel, request id, consent value, and the nested packet, and accepts any
envelope from the same major version so a minor protocol bump does not break
every deployed receiver at once.
