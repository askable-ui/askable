# Region, Circle, Lasso & Text Capture

Beyond implicit focus and Ask AI buttons, askable-ui lets the user **mark exactly what they mean** — drag a rectangle, draw a circle around an anomaly, freehand-lasso an irregular area, or select text. Each gesture serializes to a [Context packet](/guide/context) with the selection geometry and the surrounding context.

These primitives live in `@askable-ui/core` and work in any framework. Every framework package also wraps them as hooks — see [Framework hooks](#framework-hooks) below.

## Region, square, circle, and lasso

`createAskableRegionCapture(ctx, options)` mounts a pointer-driven overlay. The user drags (region/square), draws (circle), or traces (lasso) a shape; on release, a Context packet is emitted to `onCapture`.

```ts
import { createAskableContext, createAskableRegionCapture } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document);

const capture = createAskableRegionCapture(ctx, {
  shape: 'lasso',                 // 'region' | 'square' | 'circle' | 'lasso'
  intent: 'explain this region',
  onCapture: (packet, selection) => {
    sendToAI(packet);             // packet is a WebContextPacket
  },
  onCancel: () => console.log('cancelled'),
});

// Mount the overlay when the user clicks your "Select region" button:
capture.start();

// Tear down when you're done:
capture.destroy();
```

### Shapes

| `shape` | Gesture | Use it for |
|---|---|---|
| `'region'` *(default)* | Drag a rectangle | Marking a rectangular area |
| `'square'` | Drag a constrained square | Fixed-aspect selections |
| `'circle'` | Draw a circle | Pointing at an anomaly or object |
| `'lasso'` | Freehand trace | Irregular, hand-drawn areas |

### Key options

| Option | Default | Description |
|---|---|---|
| `shape` | `'region'` | Capture shape (see table above). |
| `minSize` | `6` | Minimum width/height in CSS px before a selection is accepted. |
| `once` | `true` | Remove the overlay after the first accepted capture. Set `false` to keep capturing. |
| `selectionAffordance` | `false` | Opt-in selected-state UI shown after capture, optionally with an anchored prompt. |
| `theme` | — | Partial theme overrides for the overlay (stroke, fill, lasso gradient, prompt colors). |
| `onCapture` | — | `(packet, selection) => void` after a shape is accepted and serialized. |
| `onSelectionChange` | — | Fires when the pinned selection changes or is cleared. |
| `onCancel` | — | Fires when an active capture is cancelled (e.g. `Escape`). |

### Handle

`createAskableRegionCapture` returns a handle:

```ts
capture.start();           // mount the overlay
capture.isActive();        // → boolean
capture.getSelection();    // → current pinned selection state | null
capture.clearSelection();  // clear the pinned selection
capture.cancel();          // cancel an in-progress capture
capture.destroy();         // remove the overlay and listeners
```

## Text selection

`createAskableTextSelectionCapture(ctx, options)` listens for text selections and emits a packet each time the user highlights text. Use `captureNow()` to snapshot the current selection on demand (e.g. from a toolbar button) without waiting for a `selectionchange` event.

```ts
import { createAskableTextSelectionCapture } from '@askable-ui/core';

const capture = createAskableTextSelectionCapture(ctx, {
  minLength: 3,            // ignore very short selections
  debounce: 200,          // ms; smooths rapid selectionchange events
  onCapture: (packet) => sendToAI(packet),
});

capture.start();

// Snapshot the current selection on demand — returns the packet or null:
const packet = capture.captureNow();
```

### Key options

| Option | Default | Description |
|---|---|---|
| `root` | `document` | Element/Document to observe for selections. |
| `minLength` | `1` | Minimum selected length before a selection is accepted. |
| `debounce` | `120` | Debounce (ms) for `selectionchange` events. |
| `once` | `false` | Remove listeners after the first accepted capture. |
| `dedupe` | `true` | Ignore duplicate selections with the same text and bounds. |
| `selectionAffordance` | `false` | Opt-in selected-state UI, optionally with an anchored prompt. |
| `onCapture` | — | `(packet, selection) => void` after selected text is serialized. |

The handle adds `captureNow(overrides?)` to the same `start` / `cancel` / `clearSelection` / `getSelection` / `destroy` / `isActive` shape as region capture.

## Framework hooks

Every framework package wraps these primitives so cleanup is automatic. The hook names are identical across frameworks:

| Framework | Region/circle/lasso | Text selection |
|---|---|---|
| React | `useAskableRegionCapture()` | `useAskableTextSelectionCapture()` |
| Vue | `useAskableRegionCapture()` | `useAskableTextSelectionCapture()` |
| Svelte | `useAskableRegionCapture` (`.svelte.ts`) | `useAskableTextSelectionCapture` |
| SolidJS | `useAskableRegionCapture()` | `useAskableTextSelectionCapture()` |

```tsx
// React
import { useAskableRegionCapture } from '@askable-ui/react';

function SelectRegionButton() {
  const { start, active, lastPacket } = useAskableRegionCapture({ shape: 'circle' });

  return (
    <>
      <button onClick={() => start()} disabled={active}>Circle an anomaly</button>
      {lastPacket && <SendToAi packet={lastPacket} />}
    </>
  );
}
```

See the [React guide](/guide/react#region-circle-and-lasso-capture) for a complete, framework-specific walkthrough.

## SSR safety

When there is no `document` (server rendering), both factories return an **inert handle** — every method is a no-op and `getSelection()` / `captureNow()` return `null`. You can call them unconditionally during SSR; the overlay only mounts in the browser once `start()` runs. See [SSR Safety](/guide/ssr) for details.

## Output

Every capture produces a [Context packet](/guide/context) — a structured `WebContextPacket` with `capture.mode` (`region` / `circle` / `lasso` / `text-selection`), the selection geometry, and the surrounding context. Pass it straight to your AI backend, or use `toPromptContext()` if you prefer a plain string.
