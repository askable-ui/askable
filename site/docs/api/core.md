# @askable-ui/core

Framework-agnostic context tracker. Zero dependencies and built to stay lightweight.

## Install

```bash
npm install @askable-ui/core
```

## `createAskableContext(options?)`

Factory function. Returns a new `AskableContext` instance.

```ts
import { createAskableContext } from '@askable-ui/core';

// Default — uses textContent for text extraction, no sanitization
const ctx = createAskableContext();

// Custom text extractor — prefer ARIA labels
const ctx = createAskableContext({
  textExtractor: (el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
});

// Sanitize sensitive fields before capture
const ctx = createAskableContext({
  sanitizeMeta: ({ password, ssn, ...safe }) => safe,
  sanitizeText: (text) => text.replace(/\b\d{16}\b/g, '[card]'),
});

// Track all annotated elements currently visible in the viewport
const viewportCtx = createAskableContext({ viewport: true });
```

**Options (`AskableContextOptions`):**

| Option | Type | Description |
|---|---|---|
| `viewport` | `boolean` | Enable viewport tracking via `IntersectionObserver`. Default: `false`. |
| `textExtractor` | `(el: HTMLElement) => string` | Custom text extractor. Defaults to `el.textContent?.trim()`. Applied at capture time. |
| `sanitizeMeta` | `(meta: Record<string, unknown>) => Record<string, unknown>` | Redact/transform object meta before storing. Not called for string meta. Applied at capture time. |
| `sanitizeText` | `(text: string) => string` | Redact/transform text content before storing. Applied at capture time. |

---

## HTML attributes

| Attribute | Value | Description |
|---|---|---|
| `data-askable` | JSON object or string | Marks an element as askable. Value becomes `AskableFocus.meta`. |
| `data-askable-scope` | string | Optional category filter. Scoped queries like `ctx.toPromptContext({ scope: 'analytics' })` include matching scoped entries plus unscoped ones. |
| `data-askable-parent` | CSS selector | Explicit parent annotation to use in hierarchy paths when DOM nesting alone is not enough. |
| `data-askable-priority` | integer | Override the default innermost-wins rule in `'deepest'` strategy. Higher values win. |
| `data-askable-text` | string | Override the text captured from this element. Empty string `""` suppresses text entirely. Takes priority over `textExtractor`. |

---

## `AskableContext`

### `observe(root, options?)`

Start observing a DOM subtree for `[data-askable]` elements. Attaches event listeners to all matching elements and uses a `MutationObserver` to track dynamically added/removed elements as well as attribute updates to `data-askable`, `data-askable-text`, and `data-askable-priority`.

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

// On touch/coarse-pointer devices, hover-only configs resolve from tap by default
ctx.observe(document, { events: ['hover'] });

// Throttle hover — at most one update per window
ctx.observe(document, { hoverThrottle: 100 });
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `root` | `HTMLElement \| Document` | Root element to observe |
| `options.events` | `AskableEvent[]` | Trigger events. Default: `['click', 'hover', 'focus']`. On touch/coarse-pointer devices, `hover` resolves from tap by default. |
| `options.targetStrategy` | `AskableTargetStrategy` | Which element wins when nested `[data-askable]` elements are involved. Default: `'deepest'` |
| `options.hoverDebounce` | `number` | Debounce delay in ms for hover interactions. Default: `0` |
| `options.hoverThrottle` | `number` | Throttle window in ms for hover interactions. Default: `0` |

**`AskableTargetStrategy` values:**

| Value | Behaviour |
|---|---|
| `'deepest'` | Innermost `[data-askable]` element wins. Override with `data-askable-priority`. |
| `'shallowest'` | Outermost `[data-askable]` ancestor wins; inner elements are suppressed. |
| `'exact'` | Only fires when the event target itself has `[data-askable]`. No bubbled triggers. |

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
  console.log(focus.source);    // 'dom' | 'select' | 'push'
  console.log(focus.meta);      // Record<string, unknown> | string
  console.log(focus.ancestors); // optional ancestor chain, outermost first
  console.log(focus.text);      // trimmed textContent
  console.log(focus.element);   // HTMLElement | undefined (undefined for push())
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
| `'focus'` | `AskableFocus` | A `[data-askable]` element is clicked, hovered, focused, `select()` is called, or `push()` is called |
| `'clear'` | `null` | `ctx.clear()` is called |

---

### `select(element)`

Programmatically set focus to any `HTMLElement`. Fires the `'focus'` event and updates history. Use for "Ask AI" button patterns.

```ts
const el = document.querySelector('[data-askable]') as HTMLElement;
ctx.select(el);
```

---

### `push(meta, text?, options?)`

Set focus from data alone — no DOM element required. Fires the `'focus'` event and updates history. The resulting `AskableFocus` has `source: 'push'` and `element: undefined`.

This is the idiomatic solution for libraries that manage their own DOM (AG Grid, TanStack Table, chart libraries, etc.) where you cannot add `data-askable` attributes to internal elements.

```ts
// Object meta
ctx.push({ widget: 'deals-table', rowIndex: 3, company: 'Acme' }, 'Acme Corp — Closed Won');

// String meta
ctx.push('row-label');

// No text
ctx.push({ chart: 'revenue', period: 'Q3' });

// Explicit hierarchy for non-DOM or synthetic UIs
ctx.push(
  { metric: 'revenue', value: '$2.3M' },
  'Revenue card',
  {
    ancestors: [
      { meta: { view: 'dashboard' }, text: 'Dashboard' },
      { meta: { tab: 'finance' }, text: 'Finance' },
    ],
  },
);
```

Sanitizers (`sanitizeMeta`, `sanitizeText`) apply to `push()` the same way they apply to DOM-sourced focus.

---

### `clear()`

Reset current focus to `null` and fire the `'clear'` event. History is not affected.

```ts
ctx.clear();
```

---

### `subscribe(callback, options?)`

Subscribe to serialized context updates for streaming or long-running AI integrations. The callback receives the latest `ctx.toContext()` output plus the current `AskableFocus | null`. Returns an unsubscribe function.

```ts
const unsubscribe = ctx.subscribe((context, focus) => {
  streamTransport.send({
    type: 'ui-context',
    context,
    focusMeta: focus?.meta ?? null,
  });
}, {
  history: 3,
  debounce: 100,
});

// later
unsubscribe();
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `history` | `number` | `0` | Number of history entries to include in the serialized `toContext()` output |
| `debounce` | `number` | — | Debounce context emissions by N ms |
| `currentLabel` | `string` | `'Current'` | Label for the current focus section |
| `historyLabel` | `string` | `'Recent interactions'` | Label for the history section |
| _...all `AskablePromptContextOptions`_ | | | Passed through to serialization |

Use this when the model/runtime should stay in sync while the user keeps interacting, instead of only reading a one-time snapshot.

---

### `toPromptContext(options?)`

Serialize the current focus to a prompt-ready string. See [Prompt Serialization](/guide/serialization) for full option details.

```ts
ctx.toPromptContext();
// → "User is focused on: — metric: revenue, delta: -12% — value \"Revenue\""

ctx.toPromptContext({ hierarchyDepth: 1 });
// Limit ancestor depth when hierarchical context is available

ctx.toPromptContext({ format: 'json' });
// → '{"meta":{"metric":"revenue","delta":"-12%"},"text":"Revenue","timestamp":1712345678}'

ctx.toPromptContext({ maxTokens: 50 });
// Truncates to ~200 chars and appends [truncated] if needed

ctx.toPromptContext({ excludeKeys: ['_id'], keyOrder: ['metric', 'value'] });
ctx.toPromptContext({ scope: 'analytics' });
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
ctx.toHistoryContext(5, { scope: 'analytics' });
```

**Returns:** `string` — `'No interaction history.'` when history is empty.

---

### `toContext(options?)`

Combined current focus + history in a single prompt-ready string. When `history` is 0 or omitted, output is equivalent to `toPromptContext()` prefixed with a label.

```ts
ctx.toContext();
// → "Current: User is focused on: — metric: revenue — value "Revenue""

ctx.toContext({ history: 5 });
// → "Current: User is focused on: — metric: revenue — value "Revenue"
//
//    Recent interactions:
//    [1] User is focused on: — widget: chart — value "Churn"
//    [2] User is focused on: — page: settings"

ctx.toContext({ history: 3, currentLabel: 'Now', historyLabel: 'Before' });
// Custom section labels
```

**Options (`AskableContextOutputOptions`):**

| Option | Type | Default | Description |
|---|---|---|---|
| `history` | `number` | `0` | Number of history entries to include |
| `currentLabel` | `string` | `'Current'` | Label for the current focus section |
| `historyLabel` | `string` | `'Recent interactions'` | Label for the history section |
| _...all `AskablePromptContextOptions`_ | | | Passed through to serialization |

**Returns:** `string`

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
| `preset` | `'compact' \| 'verbose' \| 'json'` | — | Named shorthand. Individual options override it. |
| `format` | `'natural' \| 'json'` | `'natural'` | Output format |
| `includeText` | `boolean` | `true` | Include element text content |
| `maxTextLength` | `number` | — | Truncate text to N characters |
| `excludeKeys` | `string[]` | — | Omit these keys from object meta |
| `keyOrder` | `string[]` | — | Promote these keys to the front |
| `prefix` | `string` | `'User is focused on:'` | Prefix in natural format |
| `textLabel` | `string` | `'value'` | Label for text field in natural format |
| `maxTokens` | `number` | — | Token budget (4 chars/token). Truncates and appends `[truncated]`. |

**Presets:**

| Preset | Equivalent |
|---|---|
| `compact` | `{ includeText: false, format: 'natural' }` |
| `verbose` | `{ includeText: true, format: 'natural' }` |
| `json` | `{ format: 'json', includeText: true }` |

---

## `a11yTextExtractor`

Built-in accessibility-aware text extractor. Pass it as `textExtractor` to `createAskableContext()` to prefer ARIA labels and accessible names over raw `textContent`.

```ts
import { createAskableContext, a11yTextExtractor } from '@askable-ui/core';

const ctx = createAskableContext({ textExtractor: a11yTextExtractor });
```

**Priority order (returns first non-empty value):**

| Priority | Source | Notes |
|---|---|---|
| 1 | `aria-label` | Highest — explicit author label |
| 2 | `aria-labelledby` | Concatenates referenced elements |
| 3 | `title` | Tooltip/fallback label |
| 4 | `alt` | Images and image inputs |
| 5 | `placeholder` | Input hints |
| 6 | `textContent.trim()` | Default fallback |

See [Accessibility-aware text extraction](/guide/annotating#accessibility-aware-text-extraction) in the guide.
