export interface AskableFocus {
  /** Parsed data-askable attribute (JSON object or raw string) */
  meta: Record<string, unknown> | string;
  /** Trimmed textContent of the element */
  text: string;
  /** The DOM element itself */
  element: HTMLElement;
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

export interface AskableObserveOptions {
  /** Which interaction types trigger context updates. Defaults to all: ['click', 'hover', 'focus'] */
  events?: AskableEvent[];
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

export interface AskablePromptContextOptions {
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

export interface AskableSerializedFocus {
  meta: Record<string, unknown> | string;
  text?: string;
  timestamp: number;
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
  /** Reset the current focus to null and emit a 'clear' event */
  clear(): void;
  /** Serialize current focus to structured prompt-ready data */
  serializeFocus(options?: AskablePromptContextOptions): AskableSerializedFocus | null;
  /** Serialize current focus to a prompt-ready string */
  toPromptContext(options?: AskablePromptContextOptions): string;
  /** Serialize focus history to a prompt-ready string (newest first). Optional limit caps the entries returned. */
  toHistoryContext(limit?: number, options?: AskablePromptContextOptions): string;
  /** Clean up all listeners and observers */
  destroy(): void;
}
