# What’s New in v0.8.1

askable-ui v0.8.1 adds React and starter-app support for explicit region and
circle capture in "send this part of the page" agent workflows.

## Highlights

### React region and circle capture

`@askable-ui/react` now exports `useAskableRegionCapture()`:

```tsx
const { ctx } = useAskable({ viewport: true });
const capture = useAskableRegionCapture({
  ctx,
  shape: 'circle',
  intent: 'explain this selected area',
  includeViewport: true,
  onCapture: (packet) => sendToAgent(packet),
});

capture.start({ shape: 'circle' });
```

The hook mounts a temporary drag overlay and emits a Context packet with
`capture.mode` set to `region` or `circle`, explicit consent metadata, and the
selected geometry in `target.bounds`. It also exposes `active`, `lastPacket`,
`lastSelection`, `cancel()`, and `destroy()` for React UI state.

Use it when you want to:

- let a user circle part of a chart, table, or canvas
- send a visible page region to an agent
- combine manual selection geometry with viewport and focus context
- build screenshot or browser-extension capture flows on top of the same packet shape

Related docs:

- [Context Packets](/guide/context)
- [@askable-ui/react API](/api/react)

### Browser-level capture coverage

The core capture path now has Playwright coverage that exercises real pointer
drag selection in Chromium, Firefox, and WebKit through the bundled browser API.

### Starter app capture controls

`npm create @askable-ui/app` now scaffolds region and circle capture buttons and
pushes the last selected page area into CopilotKit readable context.

### 0.8 release path

All workspace packages have been bumped to `0.8.1`.

## Recommended next step

If you are integrating Askable into an AI or agent runtime, start here:

1. [Getting Started](/guide/getting-started)
2. [Context Packets](/guide/context)
3. [@askable-ui/mcp API](/api/mcp)

## Version note

The current published docs track **v0.8.1** at both:

- `/docs/`
- `/docs/v0.8.1/`
