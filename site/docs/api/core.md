# @askable-ui/core

Framework-agnostic context tracker. Zero dependencies, ~1 kb gzipped.

## Install

```bash
npm install @askable-ui/core
```

## `createAskableContext()`

Factory function. Returns a new `AskableContext` instance.

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
```

---

## `AskableContext`

### `observe(root, options?)`

Start observing a DOM subtree for `[data-askable]` elements. Attaches event listeners to all matching elements and uses a `MutationObserver` to track dynamically added/removed elements.

Safe to call outside the browser — it is a no-op if `window`, `document`, or `MutationObserver` are unavailable.

```ts
// Observe the entire document (all events)
ctx.observe(document);

// Specific element
ctx.observe(document.getElementById('dashboard')!);

// Restrict events
ctx.observe(document, { events: ['click'] });
ctx.observe(document, { events: ['click', 'focus'] });

// Debounce hover — wait until pointer settles
ctx.observe(document, { hoverDebounce: 75 });

// Throttle hover — at most one update per window
ctx.observe(document, { hoverThrottle: 100 });
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `root` | `HTMLElement \| Document` | Root element to observe |
| `options.events` | `AskableEvent[]` | Trigger events. Default: `['click', 'hover', 'focus']` |
| `options.hoverDebounce` | `number` | Debounce delay in ms for hover events. Default: `0` |
| `options.hoverThrottle` | `number` | Throttle window in ms for hover events. Default: `0` |

---

### `unobserve()`

Stop observing and detach all listeners. Does not destroy the context — you can call `observe()` again afterward.

```ts
ctx.unobserve();
```

---

### `getFocus()`

Returns the current `AskableFocus`, or `null` if no element has been interacted with.

```ts
const focus = ctx.getFocus();
if (focus) {
  console.log(focus.meta);      // Record<string, unknown> | string
  console.log(focus.text);      // trimmed textContent
  console.log(focus.element);   // HTMLElement
  console.log(focus.timestamp); // Unix ms
}
```

---

### `getHistory(limit?)`

Returns focus history, newest first. Capped at 50 entries internally.

```ts
ctx.getHistory();      // all entries
ctx.getHistory(5);     // last 5
```

**Returns:** `AskableFocus[]`

---

### `on(event, handler)` / `off(event, handler)`

Subscribe/unsubscribe to events.

```ts
const handler = (focus: AskableFocus) => {
  console.log('Focused:', focus.meta);
};

ctx.on('focus', handler);
ctx.off('focus', handler);

// 'clear' event fires when ctx.clear() is called
ctx.on('clear', () => console.log('Focus cleared'));
```

**Events:**

| Event | Payload | Fires when |
|---|---|---|
| `'focus'` | `AskableFocus` | A `[data-askable]` element is clicked, hovered, focused, or `select()` is called |
| `'clear'` | `null` | `ctx.clear()` is called |

---

### `select(element)`

Programmatically set focus to any `HTMLElement`. Fires the `'focus'` event and updates history. Use for "Ask AI" button patterns.

```ts
const el = document.querySelector('[data-askable]') as HTMLElement;
ctx.select(el);
```

---

### `clear()`

Reset current focus to `null` and fire the `'clear'` event. History is not affected.

```ts
ctx.clear();
```

---

### `toPromptContext(options?)`

Serialize the current focus to a prompt-ready string. See [Prompt Serialization](/guide/serialization) for full option details.

```ts
ctx.toPromptContext();
// → "User is focused on: — metric: revenue, delta: -12% — value "Revenue""

ctx.toPromptContext({ format: 'json' });
// → '{"meta":{"metric":"revenue","delta":"-12%"},"text":"Revenue","timestamp":1712345678}'

ctx.toPromptContext({ maxTokens: 50 });
// Truncates to ~200 chars and appends [truncated] if needed

ctx.toPromptContext({ excludeKeys: ['_id'], keyOrder: ['metric', 'value'] });
```

**Returns:** `string` — `'No UI element is currently focused.'` (or `'null'` for JSON format) when nothing is focused.

---

### `toHistoryContext(limit?, options?)`

Serialize focus history as a numbered, prompt-ready string.

```ts
ctx.toHistoryContext();
// → "[1] User is focused on: ...\n[2] User is focused on: ..."

ctx.toHistoryContext(5);
ctx.toHistoryContext(5, { excludeKeys: ['_id'], maxTokens: 200 });
```

**Returns:** `string` — `'No interaction history.'` when history is empty.

---

### `serializeFocus(options?)`

Returns structured focus data as `AskableSerializedFocus | null`. Same options as `toPromptContext()`.

```ts
const data = ctx.serializeFocus();
// → { meta: { metric: 'revenue' }, text: 'Revenue', timestamp: 1712345678 }
// → null if nothing focused
```

---

### `destroy()`

Fully tear down the context: stops observing, removes all event handlers, and resets state.

```ts
ctx.destroy();
```

---

---

## `createAskableInspector(ctx, options?)`

Mount a floating inspector panel that shows the active focus, parsed metadata, and prompt output in real time. Designed for development and demos.

```ts
import { createAskableContext, createAskableInspector } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document);

const inspector = createAskableInspector(ctx);
// Shows a floating panel in the bottom-right corner.

// Tear down when done:
inspector.destroy();
```

**Options (`AskableInspectorOptions`):**

| Option | Type | Default | Description |
|---|---|---|---|
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Panel anchor position |
| `highlight` | `boolean` | `true` | Outline the focused element |
| `promptOptions` | `AskablePromptContextOptions` | — | Options passed to `toPromptContext()` for the preview |

**Returns:** `AskableInspectorHandle` — object with `destroy()` method.

**Notes:**
- No-op in non-browser environments (SSR-safe)
- Calling `createAskableInspector()` a second time replaces any existing panel
- Add it in development only — wrap in `if (process.env.NODE_ENV !== 'production')`

---

## `AskablePromptContextOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `format` | `'natural' \| 'json'` | `'natural'` | Output format |
| `includeText` | `boolean` | `true` | Include element text content |
| `maxTextLength` | `number` | — | Truncate text to N characters |
| `excludeKeys` | `string[]` | — | Omit these keys from object meta |
| `keyOrder` | `string[]` | — | Promote these keys to the front |
| `prefix` | `string` | `'User is focused on:'` | Prefix in natural format |
| `textLabel` | `string` | `'value'` | Label for text field in natural format |
| `maxTokens` | `number` | — | Token budget (4 chars/token). Truncates and appends `[truncated]`. |
