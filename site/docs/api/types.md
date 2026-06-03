# Type Reference

All types are exported from `@askable-ui/core`.

```ts
import type {
  AskableContext,
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableAsyncContextSubscriber,
  AskableAsyncContextPacketOptions,
  AskableAsyncContextOutputOptions,
  AskableAsyncPromptContextOptions,
  AskableContextOptions,
  AskableContextOutputOptions,
  AskableCollectionSourceData,
  AskableCreateCollectionSourceOptions,
  AskableCreateSourceOptions,
  AskableContextSource,
  AskableContextSourceErrorMode,
  AskableContextSourceHandle,
  AskableContextSourceInclude,
  AskableContextSourceInfo,
  AskableContextSourceMode,
  AskableContextSourceRequest,
  AskableContextSourceResolveRequest,
  AskableContextSubscriber,
  AskableFocus,
  AskableFocusSegment,
  AskableFocusSource,
  AskableResolvedContextSource,
  AskableSerializedFocus,
  AskableSerializedFocusSegment,
  AskableSourceValue,
  AskablePromptContextOptions,
  AskablePromptFormat,
  AskablePromptPreset,
  AskablePushOptions,
  AskableEvent,
  AskableObserveOptions,
  AskableEventMap,
  AskableEventName,
  AskableEventHandler,
  AskableAsyncSubscribeOptions,
  AskableSubscribeOptions,
  WebContextPacket,
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
  /**
   * Sanitize resolved source context before serialization.
   * Applied after source-level sanitizers.
   */
  sanitizeSource?: (source: AskableResolvedContextSource) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>;
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
  /** Optional category used to filter context for different agents/copilots. */
  scope?: string;
  /** Optional ancestor chain, outermost first. */
  ancestors?: AskableFocusSegment[];
  /** Trimmed textContent of the element. */
  text: string;
  /** The DOM element. Undefined when set via push(). */
  element?: HTMLElement;
  /** Unix timestamp (ms) when focus was set. */
  timestamp: number;
}
```

```ts
interface AskableFocusSegment {
  meta: Record<string, unknown> | string;
  scope?: string;
  text: string;
}
```

---

## `AskableSerializedFocus`

The shape returned by `serializeFocus()`. Similar to `AskableFocus` but without `element`, and `text` is omitted when empty or when `includeText: false`.

```ts
interface AskableSerializedFocus {
  meta: Record<string, unknown> | string;
  scope?: string;
  ancestors?: AskableSerializedFocusSegment[];
  text?: string;
  timestamp: number;
}
```

```ts
interface AskableSerializedFocusSegment {
  meta: Record<string, unknown> | string;
  scope?: string;
  text?: string;
}
```

---

## `AskablePushOptions`

Options accepted by `ctx.push(meta, text, options)`.

```ts
interface AskablePushOptions {
  scope?: string;
  ancestors?: AskableFocusSegment[];
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
  scope?: string;                  // Optional category filter. Unscoped entries are included everywhere.
  hierarchyDepth?: number;         // Limit ancestor levels included in hierarchical context.
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

## Context Source Types

Generic app-owned context source types used by `registerSource()`,
`resolveSource()`, `toPromptContextAsync()`, and `toContextAsync()`.

```ts
type AskableContextSourceMode =
  | 'state'
  | 'visible'
  | 'selected'
  | 'summary'
  | 'all'
  | (string & {});

interface AskableContextSource {
  kind?: string;
  describe?: string | (() => string | Promise<string>);
  getState?: () => unknown | Promise<unknown>;
  resolve?: (request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  sanitize?: (source: AskableResolvedContextSource) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>;
}

interface AskableContextSourceResolveRequest {
  sourceId: string;
  mode: AskableContextSourceMode;
  focus: AskableFocus | null;
  selection?: unknown;
  maxItems?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

type AskableContextSourceErrorMode = 'include' | 'omit' | 'throw';

interface AskableContextSourceRequest {
  id: string;
  mode?: AskableContextSourceMode;
  selection?: unknown;
  maxItems?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

type AskableContextSourceInclude = string | AskableContextSourceRequest;

interface AskableResolvedContextSource {
  id: string;
  kind?: string;
  description?: string;
  mode: AskableContextSourceMode;
  state?: unknown;
  data?: unknown;
  error?: { message: string };
}

interface AskableContextSourceHandle {
  id: string;
  notifyChanged(): void;
  unregister(): void;
}

interface AskableContextSourceInfo {
  id: string;
  kind?: string;
  registeredAt: number;
  updatedAt: number;
}

interface AskableContextSourceChange {
  id?: string;
  timestamp: number;
}
```

Helper factories:

```ts
type AskableSourceValue<T> = T | (() => T | Promise<T>);

interface AskableCreateSourceOptions<TData = unknown, TState = unknown> {
  kind?: string;
  describe?: string | (() => string | Promise<string>);
  state?: AskableSourceValue<TState>;
  data?: TData | ((request: AskableContextSourceResolveRequest) => TData | Promise<TData>);
  resolve?: (request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  sanitize?: (source: AskableResolvedContextSource) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>;
}

interface AskableCollectionSourceData<TItem = unknown> {
  mode: AskableContextSourceMode;
  items?: TItem[];
  summary?: unknown;
  totalCount?: number;
  returnedCount?: number;
  truncated?: boolean;
}

interface AskableCreateCollectionSourceOptions<TItem = unknown, TState = unknown> {
  kind?: string;
  describe?: string | (() => string | Promise<string>);
  getState?: () => TState | Promise<TState>;
  getItems?: () => readonly TItem[] | Promise<readonly TItem[]>;
  getVisibleItems?: () => readonly TItem[] | Promise<readonly TItem[]>;
  getSelectedItems?: (request: AskableContextSourceResolveRequest) => readonly TItem[] | Promise<readonly TItem[]>;
  getSummary?: (request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  resolve?: (request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  maxItems?: number;
  sanitizeItem?: (item: TItem, request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  sanitize?: (source: AskableResolvedContextSource) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>;
}
```

```ts
interface AskableAsyncPromptContextOptions extends AskablePromptContextOptions {
  sources?: 'all' | AskableContextSourceInclude[];
  sourceMode?: AskableContextSourceMode;
  sourceLabel?: string;
  sourceErrorMode?: AskableContextSourceErrorMode;
}

interface AskableAsyncContextOutputOptions extends AskableContextOutputOptions {
  sources?: 'all' | AskableContextSourceInclude[];
  sourceMode?: AskableContextSourceMode;
  sourceLabel?: string;
  sourceErrorMode?: AskableContextSourceErrorMode;
}

interface AskableAsyncContextPacketOptions extends AskableContextPacketOptions {
  sources?: 'all' | AskableContextSourceInclude[];
  sourceMode?: AskableContextSourceMode;
  sourceErrorMode?: AskableContextSourceErrorMode;
}

interface AskableAgentRequestOptions extends AskableAsyncContextOutputOptions {
  requestId?: string;
  metadata?: Record<string, unknown>;
  packet?: boolean | AskableAsyncContextPacketOptions | WebContextPacket;
  contextFromPacket?: boolean;
}

interface AskableAgentRequest {
  requestId?: string;
  question: string;
  context: string;
  focus: AskableSerializedFocus | null;
  packet?: WebContextPacket;
  metadata?: Record<string, unknown>;
  timestamp: number;
}
```

```ts
type AskableContextSubscriber = (
  context: string,
  focus: AskableFocus | null
) => void;

interface AskableSubscribeOptions extends AskableContextOutputOptions {
  debounce?: number;
}

type AskableAsyncContextSubscriber = (
  context: string,
  focus: AskableFocus | null
) => void | Promise<void>;

interface AskableAsyncSubscribeOptions extends AskableAsyncContextOutputOptions {
  debounce?: number;
  emitInitial?: boolean;
  onError?: (error: unknown) => void;
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

`hover` maps to `mouseenter` on desktop/fine-pointer environments. On touch/coarse-pointer environments, hover-only observation resolves from tap by default.

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
  /** Which interaction types trigger context updates. Default: all three. Touch/coarse-pointer devices resolve hover from tap by default. */
  events?: AskableEvent[];
  /**
   * Debounce delay in ms for hover interactions.
   * When both hoverDebounce and hoverThrottle are set, debounce takes precedence.
   * Default: 0
   */
  hoverDebounce?: number;
  /**
   * Throttle window in ms for hover interactions.
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
