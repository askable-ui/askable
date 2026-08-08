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
    getPacket: () => ctx.toContextPacket(),
    formatPrompt: () => ctx.toPromptContext(),
  },
  transports: [
    createFunctionTransport(async ({ payload }) => {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: payload.question,
          context: payload.prompt,
          packet: payload.packet,
        }),
      });
    }),
  ],
});

await bridge.sendPrompt('Explain this selected account.');
```

## Browser extension handoff

A browser extension can receive Askable context without the host app knowing
which chatbot the user prefers.

```ts
import { createAskableBridge, createBrowserExtensionTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacket() },
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

## Iframe or same-window bridge

Use `postMessage` when a chat surface is embedded in an iframe or a sibling
window.

```ts
import { createAskableBridge, createPostMessageTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: { getPacket: () => ctx.toContextPacket() },
  transports: [
    createPostMessageTransport({
      targetWindow: chatFrame.contentWindow!,
      targetOrigin: 'https://chat.example.com',
    }),
  ],
});
```

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
    question: 'What should I do next?'
  }
}
```

Use `isAskableBridgeEnvelope(value)` before trusting messages from extensions,
iframes, workers, storage, or webhooks.
