# What’s New in v0.10.0

askable-ui v0.10.0 adds first-class text selection capture, so highlighted page
copy can be sent to agents as structured Context packets.

## Highlights

### Highlighted text as Context packets

`@askable-ui/core` now exports `createAskableTextSelectionCapture()` for
capturing the current browser selection or listening to user selection changes.
Packets use `capture.mode: 'text-selection'`, set explicit consent, and include
the highlighted copy in `target.text`.

```ts
import { createAskableContext, createAskableTextSelectionCapture } from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const selection = createAskableTextSelectionCapture(ctx, {
  includeViewport: true,
  intent: 'answer using the highlighted text',
  onCapture: (packet) => sendToAgent(packet),
});

selection.start();
```

Framework wrappers are available as `useAskableTextSelectionCapture()` for
React and Vue, plus `createAskableTextSelectionCaptureStore()` for Svelte.

Related docs:

- [Context Packets](/guide/context)
- [@askable-ui/core API](/api/core)
- [@askable-ui/react API](/api/react)

### Region, circle, and text capture together

Askable now covers three explicit user selection patterns:

- draw a rectangle with `createAskableRegionCapture()`
- circle something on screen with `shape: 'circle'`
- highlight copy with `createAskableTextSelectionCapture()`

All three produce the same versioned Context packet format for MCP bridges,
browser tools, and agent runtimes.

### Starter and docs version alignment

`npm create @askable-ui/app` now scaffolds projects pinned to `^0.10.0`, and the
versioned docs have been advanced to `/docs/v0.10.0/`.

## Recommended next step

If you are integrating Askable into an AI or agent runtime, start here:

1. [Getting Started](/guide/getting-started)
2. [Context Packets](/guide/context)
3. [@askable-ui/core API](/api/core)

## Version note

The current published docs track **v0.10.0** at both:

- `/docs/`
- `/docs/v0.10.0/`
