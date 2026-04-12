/** How focus was initiated */
export type AskableFocusSource = 'dom' | 'select' | 'push';

export interface AskableFocus {
  /** How focus was initiated */
  source: AskableFocusSource;
  /** Parsed data-askable attribute (JSON object or raw string) */
  meta: Record<string, unknown> | string;
  /** Trimmed textContent of the element */
  text: string;
  /** The DOM element (undefined when set via push()) */
  element?: HTMLElement;
  /** Unix timestamp (ms) of when focus was set */
  timestamp: number;
}

export type AskableEventMap = {
  focus: AskableFocus;
  /** Fires when clear() is called — focus has been reset to null */
  clear: null;
};

export type AskableEventName = keyof AskableEventMap;

export type AskableEventHandler<K extends AskableEventName> = (
  payload: AskableEventMap[K]
) => void;

export type AskableEvent = 'click' | 'hover' | 'focus';

/**
 * Controls which [data-askable] element handles an interaction when multiple
 * elements are nested.
 *
 * - `'deepest'`  (default) — innermost element wins. Override with `data-askable-priority`.
 * - `'shallowest'` — outermost element wins.
 * - `'exact'`    — only fires when the event target itself has `[data-askable]`.
 *                  Parent elements are never triggered via bubbling.
 */
export type AskableTargetStrategy = 'deepest' | 'shallowest' | 'exact';

export interface AskableObserveOptions {
  /** Which interaction types trigger context updates. Defaults to all: ['click', 'hover', 'focus'] */
  events?: AskableEvent[];
  /**
   * How to resolve the winning element when nested [data-askable] elements are involved.
   * See `AskableTargetStrategy` for details.
   * @default 'deepest'
   */
  targetStrategy?: AskableTargetStrategy;
  /**
   * Debounce delay in ms applied to hover (mouseenter) events.
   * Prevents rapid context switches when the user moves the cursor across many elements.
   * Defaults to 0 (no debounce).
   * When both hoverDebounce and hoverThrottle are provided, debounce takes precedence.
   */
  hoverDebounce?: number;
  /**
   * Throttle window in ms applied to hover (mouseenter) events.
   * Emits at most one hover focus update per window, which can be useful for large dashboards.
   * Defaults to 0 (no throttle).
   */
  hoverThrottle?: number;
}

export type AskablePromptFormat = 'natural' | 'json';

/**
 * Named presets for prompt serialization. Individual options override the preset.
 *
 * - `compact`  — meta only, no text content. Good for tight token budgets.
 * - `verbose`  — meta + full text (same as default, but explicit).
 * - `json`     — structured JSON output, includes meta + text.
 */
export type AskablePromptPreset = 'compact' | 'verbose' | 'json';

export interface AskablePromptContextOptions {
  /**
   * Apply a named preset as the default configuration.
   * Individual options specified alongside the preset take precedence.
   *
   * - `compact` → `{ includeText: false, format: 'natural' }`
   * - `verbose` → `{ includeText: true, format: 'natural' }`
   * - `json`    → `{ format: 'json', includeText: true }`
   */
  preset?: AskablePromptPreset;
  /** Output format. Defaults to natural language. */
  format?: AskablePromptFormat;
  /** Include extracted text in serialized output. Defaults to true. */
  includeText?: boolean;
  /** Optional text truncation length. No limit by default. */
  maxTextLength?: number;
  /** Exclude specific meta keys when meta is an object. */
  excludeKeys?: string[];
  /** Promote keys to the front in this order when meta is an object. */
  keyOrder?: string[];
  /** Prefix used in natural format. Defaults to "User is focused on:" */
  prefix?: string;
  /** Label used for text in natural format. Defaults to "value" */
  textLabel?: string;
  /**
   * Approximate token budget for the output string.
   * Uses a 4 chars/token estimate. If the serialized output exceeds the budget
   * it is truncated and a `[truncated]` marker is appended.
   * No limit by default.
   */
  maxTokens?: number;
}

/**
 * Options for creating an AskableContext.
 */
export interface AskableContextOptions {
  /**
   * Optional name for reusing a shared context instance across the same page/runtime.
   * Unnamed contexts remain independent.
   */
  name?: string;
  /**
   * Custom text extractor called for each focused element.
   * Receives the DOM element, returns the text to use as `AskableFocus.text`.
   * Defaults to `el.textContent?.trim() ?? ''`.
   * Applied at capture time — affects `getFocus()`, history, events, and all serialization.
   */
  textExtractor?: (el: HTMLElement) => string;
  /**
   * Sanitize or redact metadata before it is stored and emitted.
   * Only invoked when meta is a JSON object (not a plain string).
   * Applied at capture time — affects `getFocus()`, history, events, and all serialization.
   *
   * @example
   * createAskableContext({
   *   sanitizeMeta: ({ password, ssn, ...safe }) => safe
   * })
   */
  sanitizeMeta?: (meta: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Sanitize or redact text content before it is stored and emitted.
   * Applied at capture time — affects `getFocus()`, history, events, and all serialization.
   *
   * @example
   * createAskableContext({
   *   sanitizeText: (text) => text.replace(/\b\d{16}\b/g, '[card]')
   * })
   */
  sanitizeText?: (text: string) => string;
  /**
   * Maximum number of focus entries retained in history.
   * Oldest entries are evicted when the limit is exceeded.
   * Defaults to 50. Set to 0 to disable history entirely.
   *
   * @example
   * createAskableContext({ maxHistory: 10 })
   */
  maxHistory?: number;
}

export interface AskableSerializedFocus {
  meta: Record<string, unknown> | string;
  text?: string;
  timestamp: number;
}

export interface AskableContextOutputOptions extends AskablePromptContextOptions {
  /** Number of history entries to include. Defaults to 0 (current focus only). */
  history?: number;
  /** Label for the current focus section. Defaults to "Current". */
  currentLabel?: string;
  /** Label for the history section. Defaults to "Recent interactions". */
  historyLabel?: string;
}

export interface AskableContext {
  /** Observe a DOM subtree for [data-askable] elements */
  observe(root: HTMLElement | Document, options?: AskableObserveOptions): void;
  /** Stop observing and detach all listeners */
  unobserve(): void;
  /** Get the current focus context */
  getFocus(): AskableFocus | null;
  /** Return the focus history, newest first. Optional limit caps the result. */
  getHistory(limit?: number): AskableFocus[];
  /** Subscribe to an event */
  on<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void;
  /** Unsubscribe from an event */
  off<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void;
  /** Programmatically select an element — use for explicit "Ask AI" buttons */
  select(element: HTMLElement): void;
  /** Set focus from data alone — no DOM element required. Ideal for virtualizing table libraries. */
  push(meta: Record<string, unknown> | string, text?: string): void;
  /** Reset the current focus to null and emit a 'clear' event */
  clear(): void;
  /** Serialize current focus to structured prompt-ready data */
  serializeFocus(options?: AskablePromptContextOptions): AskableSerializedFocus | null;
  /** Serialize current focus to a prompt-ready string */
  toPromptContext(options?: AskablePromptContextOptions): string;
  /** Serialize focus history to a prompt-ready string (newest first). Optional limit caps the entries returned. */
  toHistoryContext(limit?: number, options?: AskablePromptContextOptions): string;
  /** Combined current focus + history in a single prompt-ready string */
  toContext(options?: AskableContextOutputOptions): string;
  /** Clean up all listeners and observers */
  destroy(): void;
}
