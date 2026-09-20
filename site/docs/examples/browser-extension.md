# Browser Extension Companion

The browser extension example shows how Askable can capture context without
requiring the site owner to change their app. It is the starting point for a
local companion that sends selected or page context into a chat product,
webhook, or MCP bridge.

## Install and build

```bash
cd examples/browser-extension
npm install
npm run build
```

Load `examples/browser-extension/dist` as an unpacked extension from
`chrome://extensions`.

## Flow

```text
popup capture button
  -> content script
  -> page, selection, or DOM source
  -> @askable-ui/bridge
  -> extension background worker
```

The content script creates an Askable context, registers fallback page and DOM
sources, and sends a bridge envelope:

```ts
import {
  createAskableContext,
  createAskableDOMSource,
  createAskablePageSource,
} from '@askable-ui/core';
import { createAskableBridge, createBrowserExtensionTransport } from '@askable-ui/bridge';

const ctx = createAskableContext();
ctx.observe(document, { events: ['click', 'focus'] });
ctx.registerSource('page', createAskablePageSource({ includeLinks: true }));
ctx.registerSource('element', createAskableDOMSource({ getElement: () => lastElement }));

const bridge = createAskableBridge({
  transports: [createBrowserExtensionTransport()],
});

const packet = await ctx.toContextPacketAsync({
  mode: 'full-page',
  privacy: { consent: 'explicit', redacted: false },
  provenance: { method: 'extension' },
  sources: [{ id: 'page', mode: 'all', maxTokens: 3000 }],
});

await bridge.send(packet, {
  prompt: await ctx.toContextAsync({ sources: [{ id: 'page', mode: 'all' }] }),
});
```

The background worker validates the envelope before trusting it:

```ts
import { isAskableBridgeEnvelope } from '@askable-ui/bridge';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'askable:bridge:context') return false;
  if (!isAskableBridgeEnvelope(message.envelope)) {
    sendResponse({ ok: false });
    return true;
  }

  sendResponse({ ok: true, requestId: message.envelope.requestId });
  return true;
});
```

## What works without site code

| Context | Available from extension fallback |
|---|---|
| Selected text | Yes |
| Full page text | Yes, bounded by the extension |
| Headings and links | Yes |
| Last clicked or focused DOM element | Yes |
| Rich app state, hidden table pages, selected rows, filters | Only when the app exposes it through `data-askable` or registered sources |

Use this example for the general browser companion path. Use framework
integrations or custom sources when you own the app and need precise state such
as full paginated table data, chart series, or authenticated business objects.
