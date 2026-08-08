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
    getPacket: () => ctx.toContextPacket(),
    formatPrompt: () => ctx.toPromptContext(),
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

## Send context to a browser extension

```ts
import { createAskableBridge, createBrowserExtensionTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacket() },
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
  console.log(message.envelope.payload.packet);
});
```

## Send context over `postMessage`

```ts
import { createAskableBridge, createPostMessageTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacket() },
  transports: [
    createPostMessageTransport({
      targetOrigin: 'https://chat.example.com',
      targetWindow: iframe.contentWindow!,
    }),
  ],
});
```

## Send context to an HTTP endpoint

```ts
import { createAskableBridge, createHttpTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacket() },
  transports: [
    createHttpTransport({
      url: '/api/askable/context',
      headers: () => ({ authorization: `Bearer ${sessionToken}` }),
    }),
  ],
});
```

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
    question: 'What should I do next?'
  }
}
```

Use `isAskableBridgeEnvelope(value)` at extension, iframe, worker, webhook, and
storage boundaries before trusting the payload.
