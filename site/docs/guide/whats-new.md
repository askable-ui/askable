# What’s New in v0.11.0

askable-ui v0.11.0 adds lasso capture, so users can freehand-select irregular
areas of the page and send the shape to agents as structured Context packets.

## Highlights

### Freehand lasso Context packets

`createAskableRegionCapture()` now accepts `shape: 'lasso'`. Lasso packets use
`capture.mode: 'lasso'`, set explicit consent, include the selected bounds in
`target.bounds`, and include the freehand point path in
`target.metadata.points`.

```ts
import { createAskableContext, createAskableRegionCapture } from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const capture = createAskableRegionCapture(ctx, {
  shape: 'lasso',
  includeViewport: true,
  intent: 'answer using this freehand-selected region',
  onCapture: (packet) => sendToAgent(packet),
});

capture.start();
```

Framework wrappers already expose the same `shape` override through
`useAskableRegionCapture()` for React and Vue, plus
`createAskableRegionCaptureStore()` for Svelte.

Related docs:

- [Context Packets](/guide/context)
- [@askable-ui/core API](/api/core)
- [@askable-ui/react API](/api/react)

### Region, circle, lasso, and text capture together

Askable now covers four explicit user selection patterns:

- draw a rectangle with `createAskableRegionCapture()`
- circle something on screen with `shape: 'circle'`
- lasso an irregular shape with `shape: 'lasso'`
- highlight copy with `createAskableTextSelectionCapture()`

All three produce the same versioned Context packet format for MCP bridges,
browser tools, and agent runtimes.

### Starter and docs version alignment

`npm create @askable-ui/app` now scaffolds projects pinned to `^0.11.0`, and the
versioned docs have been advanced to `/docs/v0.11.0/`.

## Recommended next step

If you are integrating Askable into an AI or agent runtime, start here:

1. [Getting Started](/guide/getting-started)
2. [Context Packets](/guide/context)
3. [@askable-ui/core API](/api/core)

## Version note

The current published docs track **v0.11.0** at both:

- `/docs/`
- `/docs/v0.11.0/`
