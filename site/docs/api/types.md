# Type Reference

All types are exported from `@askable-ui/core`.

```ts
import type {
  AskableContext,
  AskableContextOptions,
  AskableContextOutputOptions,
  AskableFocus,
  AskableFocusSource,
  AskableSerializedFocus,
  AskablePromptContextOptions,
  AskablePromptFormat,
  AskablePromptPreset,
  AskableEvent,
  AskableObserveOptions,
  AskableEventMap,
  AskableEventName,
  AskableEventHandler,
} from '@askable-ui/core';
```

---

## `AskableContextOptions`

Options passed to `createAskableContext()`.

```ts
interface AskableContextOptions {
  /**
   * Optional shared context name. Contexts with the same name reuse one instance
   * in the same page/runtime; unnamed contexts remain independent.
   */
  name?: string;
  /**
   * Track which annotated elements are currently visible in the viewport.
   * Off by default to avoid extra observer overhead.
   */
  viewport?: boolean;
  /**
   * Custom text extractor. Defaults to el.textContent?.trim() ?? ''
   * Applied at capture time.
   */
  textExtractor?: (el: HTMLElement) => string;
  /**
   * Sanitize object meta before storing/emitting.
   * Applied at capture time. Not called for string meta.
   */
  sanitizeMeta?: (meta: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Sanitize text content before storing/emitting.
   * Applied at capture time.
   */
  sanitizeText?: (text: string) => string;
}
```

---

## `AskableFocusSource`

Indicates how focus was initiated.

```ts
type AskableFocusSource = 'dom' | 'select' | 'push';
```

| Value | Set by |
|---|---|
| `'dom'` | User interaction (click, hover, keyboard focus) via the Observer |
| `'select'` | `ctx.select(element)` — explicit "Ask AI" button patterns |
| `'push'` | `ctx.push(meta, text)` — programmatic focus without a DOM element |

---

## `AskableFocus`

The shape of focus state objects returned by `getFocus()`, `getHistory()`, and passed to `'focus'` event handlers.

```ts
interface AskableFocus {
  /** How focus was initiated. */
  source: AskableFocusSource;
  /** Parsed data-askable value. JSON → object; plain string → string. */
  meta: Record<string, unknown> | string;
  /** Trimmed textContent of the element. */
  text: string;
  /** The DOM element. Undefined when set via push(). */
  element?: HTMLElement;
  /** Unix timestamp (ms) when focus was set. */
  timestamp: number;
}
```

---

## `AskableSerializedFocus`

The shape returned by `serializeFocus()`. Similar to `AskableFocus` but without `element`, and `text` is omitted when empty or when `includeText: false`.

```ts
interface AskableSerializedFocus {
  meta: Record<string, unknown> | string;
  text?: string;
  timestamp: number;
}
```

---

## `AskablePromptPreset`

Named shorthand for common option combinations. See [Prompt Serialization → Presets](/guide/serialization#presets).

```ts
type AskablePromptPreset = 'compact' | 'verbose' | 'json';
```

| Value | Equivalent |
|---|---|
| `compact` | `{ includeText: false, format: 'natural' }` |
| `verbose` | `{ includeText: true, format: 'natural' }` |
| `json` | `{ format: 'json', includeText: true }` |

---

## `AskablePromptContextOptions`

Options accepted by `toPromptContext()`, `toHistoryContext()`, and `serializeFocus()`.

```ts
interface AskablePromptContextOptions {
  preset?: AskablePromptPreset;    // Named shorthand. Individual options override it.
  format?: AskablePromptFormat;    // 'natural' | 'json'. Default: 'natural'
  includeText?: boolean;           // Include element text. Default: true
  maxTextLength?: number;          // Truncate text to N chars
  excludeKeys?: string[];          // Omit these keys from object meta
  keyOrder?: string[];             // Promote these keys to the front
  prefix?: string;                 // Prefix in natural format. Default: 'User is focused on:'
  textLabel?: string;              // Label for text. Default: 'value'
  maxTokens?: number;              // Token budget (4 chars/token). Appends [truncated] if exceeded.
}
```

---

## `AskableContextOutputOptions`

Options accepted by `toContext()`. Extends `AskablePromptContextOptions`.

```ts
interface AskableContextOutputOptions extends AskablePromptContextOptions {
  /** Number of history entries to include. Default: 0 (current focus only). */
  history?: number;
  /** Label for the current focus section. Default: 'Current' */
  currentLabel?: string;
  /** Label for the history section. Default: 'Recent interactions' */
  historyLabel?: string;
}
```

---

## `AskableEvent`

```ts
type AskableEvent = 'click' | 'hover' | 'focus';
```

---

## `AskablePromptFormat`

```ts
type AskablePromptFormat = 'natural' | 'json';
```

---

## `AskableObserveOptions`

Options for `ctx.observe()`.

```ts
interface AskableObserveOptions {
  /** Which interaction types trigger context updates. Default: all three. */
  events?: AskableEvent[];
  /**
   * Debounce delay in ms for hover events.
   * When both hoverDebounce and hoverThrottle are set, debounce takes precedence.
   * Default: 0
   */
  hoverDebounce?: number;
  /**
   * Throttle window in ms for hover events.
   * Default: 0
   */
  hoverThrottle?: number;
}
```

---

## `AskableEventMap`

```ts
type AskableEventMap = {
  focus: AskableFocus;
  clear: null;
};
```

---

## `AskableEventName`

```ts
type AskableEventName = keyof AskableEventMap; // 'focus' | 'clear'
```

---

## `AskableEventHandler`

```ts
type AskableEventHandler<K extends AskableEventName> = (
  payload: AskableEventMap[K]
) => void;
```
