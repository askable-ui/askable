# What’s New in v0.11.1

askable-ui v0.11.1 refines explicit selection capture, so users can freehand
lasso irregular areas, keep selected text highlighted, and send richer page
context to agents.

## Highlights

### Freehand lasso selection

`createAskableRegionCapture()` supports `shape: 'lasso'`. Lasso packets use
`capture.mode: 'lasso'`, set explicit consent, include selected bounds in
`target.bounds`, and include the freehand point path in `target.metadata.points`.
The overlay now renders as a solid gradient stroke instead of a dotted region,
which makes it feel closer to a cursor-drawn visual selection.
That gradient stroke is the library default, and apps can tune it with the
`theme` option instead of rebuilding the overlay.

```ts
import { createAskableContext, createAskableRegionCapture } from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const capture = createAskableRegionCapture(ctx, {
  shape: 'lasso',
  includeViewport: true,
  intent: 'answer using this freehand-selected region',
  theme: {
    lassoStrokeWidth: 4,
  },
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

All four produce the same versioned Context packet format for MCP bridges,
browser tools, and agent runtimes.

### Starter and docs version alignment

`npm create @askable-ui/app` now scaffolds projects pinned to `^0.11.1`, and the
versioned docs have been advanced to `/docs/v0.11.1/`.

## Recommended next step

If you are integrating Askable into an AI or agent runtime, start here:

1. [Getting Started](/guide/getting-started)
2. [Context Packets](/guide/context)
3. [@askable-ui/core API](/api/core)

## Version note

The current published docs track **v0.11.1** at both:

- `/docs/`
- `/docs/v0.11.1/`
