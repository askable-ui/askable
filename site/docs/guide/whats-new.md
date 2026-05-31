# What’s New in v0.8.3

askable-ui v0.8.3 expands explicit region and circle capture across the web
framework adapters for "send this part of the page" agent workflows.

## Highlights

### Framework region and circle capture

React exports `useAskableRegionCapture()`:

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

Vue now exports the matching composable:

```ts
const capture = useAskableRegionCapture({
  includeViewport: true,
  source: { app: 'dashboard' },
});

capture.start();
capture.start({ shape: 'circle' });
```

Svelte now exports a store-based helper:

```ts
const capture = createAskableRegionCaptureStore({
  intent: 'explain this selected area',
});

capture.start({ shape: 'circle' });
```

Each wrapper mounts a temporary drag overlay and emits a Context packet with
`capture.mode` set to `region` or `circle`, explicit consent metadata, and the
selected geometry in `target.bounds`. They also expose `active`, `lastPacket`,
`lastSelection`, `cancel()`, and `destroy()` for framework-native UI state.

Use it when you want to:

- let a user circle part of a chart, table, or canvas
- send a visible page region to an agent
- combine manual selection geometry with viewport and focus context
- build screenshot or browser-extension capture flows on top of the same packet shape

Related docs:

- [Context Packets](/guide/context)
- [@askable-ui/react API](/api/react)
- [@askable-ui/vue API](/api/vue)
- [@askable-ui/svelte API](/api/svelte)

### Browser-level capture coverage

The core capture path now has Playwright coverage that exercises real pointer
drag selection in Chromium, Firefox, and WebKit through the bundled browser API.

### Starter app capture controls

`npm create @askable-ui/app` now scaffolds region and circle capture buttons and
pushes the last selected page area into CopilotKit readable context.

### 0.8 release path

All workspace packages have been bumped to `0.8.3`.

## Recommended next step

If you are integrating Askable into an AI or agent runtime, start here:

1. [Getting Started](/guide/getting-started)
2. [Context Packets](/guide/context)
3. [@askable-ui/mcp API](/api/mcp)

## Version note

The current published docs track **v0.8.3** at both:

- `/docs/`
- `/docs/v0.8.3/`
