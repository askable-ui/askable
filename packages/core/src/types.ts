import type {
  WebContextCaptureMode,
  WebContextGesture,
  WebContextPacket,
  WebContextPrivacy,
  WebContextProvenance,
  WebContextSource,
  WebContextTarget,
} from '@askable-ui/context';

/** How focus was initiated */
export type AskableFocusSource = 'dom' | 'select' | 'push';

export interface AskableFocus {
  /** How focus was initiated */
  source: AskableFocusSource;
  /** Parsed data-askable attribute (JSON object or raw string) */
  meta: Record<string, unknown> | string;
  /** Optional category used to filter context for different agents/copilots. */
  scope?: string;
  /** Optional ancestor chain from outermost to innermost parent annotation. */
  ancestors?: AskableFocusSegment[];
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
  /** Fires when a registered app-owned context source may have changed. */
  sourcechange: AskableContextSourceChange;
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
   * Debounce delay in ms applied to hover interactions.
   * On desktop this means `mouseenter`; on touch/coarse-pointer devices, hover-only
   * configurations resolve from tap by default.
   * Prevents rapid context switches when the user moves the cursor across many elements.
   * Defaults to 0 (no debounce).
   * When both hoverDebounce and hoverThrottle are provided, debounce takes precedence.
   */
  hoverDebounce?: number;
  /**
   * Throttle window in ms applied to hover interactions.
   * On desktop this means `mouseenter`; on touch/coarse-pointer devices, hover-only
   * configurations resolve from tap by default.
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

export interface AskableFocusSegment {
  meta: Record<string, unknown> | string;
  scope?: string;
  text: string;
}

export interface AskableSerializedFocusSegment {
  meta: Record<string, unknown> | string;
  scope?: string;
  text?: string;
}

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
  /** Optional scope/category filter. Unscoped entries are included in every scoped view. */
  scope?: string;
  /** Number of ancestor levels to include, counting back from the immediate annotated parent. Defaults to the full chain. */
  hierarchyDepth?: number;
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

export type AskableContextSourceMode =
  | 'state'
  | 'visible'
  | 'selected'
  | 'summary'
  | 'all'
  | (string & {});

export type AskablePacketSourceSelectionTarget = Pick<
  WebContextTarget,
  'label' | 'role' | 'selector' | 'bounds' | 'text' | 'metadata'
>;

export interface AskablePacketSourceSelection {
  /** Capture metadata from the selected Context packet. */
  capture: WebContextPacket['capture'];
  /** Page or app source metadata from the selected Context packet. */
  source: WebContextSource;
  /** Selected packet target, when the packet has one. */
  target?: AskablePacketSourceSelectionTarget;
}

export interface AskableContextSourceResolveRequest {
  /** Registered source id. */
  sourceId: string;
  /** Requested slice of context. Defaults to "summary". */
  mode: AskableContextSourceMode;
  /** Current Askable focus, if any, so sources can resolve the user's active reference. */
  focus: AskableFocus | null;
  /** Optional app-defined selection payload, such as row ids, ranges, or canvas bounds. */
  selection?: unknown;
  /** Optional item cap for sources that can return many records. */
  maxItems?: number;
  /** Optional token budget for source-owned summaries. */
  maxTokens?: number;
  /** Optional timeout in ms for this source request. */
  timeoutMs?: number;
  /** Optional cancellation signal for async source work. */
  signal?: AbortSignal;
}

export type AskableContextSourceErrorMode = 'include' | 'omit' | 'throw';

export interface AskableContextSource {
  /** Source category. Examples: "collection", "document", "chart", "map", "canvas", "custom". */
  kind?: string;
  /** Modes this source can resolve, for source pickers, inspectors, and agent controls. */
  modes?: readonly AskableContextSourceMode[];
  /** Human-readable source description. */
  describe?: string | (() => string | Promise<string>);
  /** Current app state for this source, such as filters, sort, page, route, or viewport. */
  getState?: () => unknown | Promise<unknown>;
  /** Resolve app-owned context for the requested mode. */
  resolve?: (request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  /** Redact/transform this source before it is serialized. */
  sanitize?: (source: AskableResolvedContextSource) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>;
}

export interface AskableContextSourceHandle {
  id: string;
  notifyChanged(): void;
  unregister(): void;
}

export interface AskableContextSourceInfo {
  /** Registered source id. */
  id: string;
  /** Source category, when provided by the source. */
  kind?: string;
  /** Modes this source advertises without resolving source data. */
  modes?: readonly AskableContextSourceMode[];
  /** Unix timestamp (ms) when this source id was last registered. */
  registeredAt: number;
  /** Unix timestamp (ms) when this source was last registered or notified as changed. */
  updatedAt: number;
}

export interface AskableContextSourceChange {
  /** Source id that changed. Omitted when all registered sources should be refreshed. */
  id?: string;
  /** Unix timestamp (ms) when the change was signalled. */
  timestamp: number;
}

export interface AskableContextSourceRequest {
  /** Registered source id. */
  id: string;
  /** Requested slice of context. Defaults to the top-level sourceMode, then "summary". */
  mode?: AskableContextSourceMode;
  /** Optional app-defined selection payload passed to the source resolver. */
  selection?: unknown;
  /** Optional item cap for sources that can return many records. */
  maxItems?: number;
  /** Optional token budget for source-owned summaries. */
  maxTokens?: number;
  /** Optional timeout in ms for this source request. */
  timeoutMs?: number;
  /** Optional cancellation signal for async source work. */
  signal?: AbortSignal;
}

export type AskableContextSourceInclude = string | AskableContextSourceRequest;

export interface AskableResolvedContextSource {
  id: string;
  kind?: string;
  description?: string;
  mode: AskableContextSourceMode;
  state?: unknown;
  data?: unknown;
  error?: {
    message: string;
  };
}

export interface AskableAsyncPromptContextOptions extends AskablePromptContextOptions {
  /** Sources to include. Use "all" for every registered source. */
  sources?: 'all' | AskableContextSourceInclude[];
  /** Default source mode when a source request omits mode. Defaults to "summary". */
  sourceMode?: AskableContextSourceMode;
  /** Heading used in natural-language output. Defaults to "Context sources". */
  sourceLabel?: string;
  /** How async prompt generation handles failed sources. Defaults to "include". */
  sourceErrorMode?: AskableContextSourceErrorMode;
}

export interface AskableAsyncContextOutputOptions extends AskableContextOutputOptions {
  /** Sources to include. Use "all" for every registered source. */
  sources?: 'all' | AskableContextSourceInclude[];
  /** Default source mode when a source request omits mode. Defaults to "summary". */
  sourceMode?: AskableContextSourceMode;
  /** Heading used in natural-language output. Defaults to "Context sources". */
  sourceLabel?: string;
  /** How async prompt generation handles failed sources. Defaults to "include". */
  sourceErrorMode?: AskableContextSourceErrorMode;
}

export interface AskableResolveSourcesOptions {
  /** Sources to resolve. Defaults to "all" registered sources. */
  sources?: 'all' | AskableContextSourceInclude[];
  /** Default source mode when a source request omits `mode`. Defaults to "summary". */
  sourceMode?: AskableContextSourceMode;
  /** How source failures are handled. Defaults to "include". */
  sourceErrorMode?: AskableContextSourceErrorMode;
}

/**
 * Options for creating an AskableContext.
 */
export interface AskableSubscribeOptions extends AskableContextOutputOptions {
  /**
   * Debounce delay in ms applied to subscription callbacks.
   * Useful when streaming LLM responses should not be updated on every rapid focus change.
   * Defaults to 0 (no debounce).
   */
  debounce?: number;
}

export type AskableContextSubscriber = (context: string, focus: AskableFocus | null) => void;

export interface AskableAsyncSubscribeOptions extends AskableAsyncContextOutputOptions {
  /**
   * Debounce delay in ms applied to subscription callbacks.
   * Useful when source-backed context should not resolve on every rapid focus change.
   * Defaults to 0 (no debounce).
   */
  debounce?: number;
  /**
   * Emit once immediately with the current context after the subscriber is registered.
   * Defaults to false.
   */
  emitInitial?: boolean;
  /** Called when async context resolution or the subscriber callback fails. */
  onError?: (error: unknown) => void;
}

export type AskableAsyncContextSubscriber = (
  context: string,
  focus: AskableFocus | null
) => void | Promise<void>;

export interface AskableContextOptions {
  /**
   * Optional name for reusing a shared context instance across the same page/runtime.
   * Unnamed contexts remain independent.
   */
  name?: string;
  /**
   * Track which annotated elements are currently visible in the viewport.
   * Off by default to avoid extra observer overhead.
   */
  viewport?: boolean;
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
   * Sanitize or redact resolved source context before it is serialized.
   * Applied after source-level sanitizers.
   */
  sanitizeSource?: (source: AskableResolvedContextSource) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>;
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
  scope?: string;
  ancestors?: AskableSerializedFocusSegment[];
  text?: string;
  timestamp: number;
}

export interface AskablePushOptions {
  /** Optional category used to filter context for different agents/copilots. */
  scope?: string;
  /** Optional ancestor chain from outermost to innermost parent annotation. */
  ancestors?: AskableFocusSegment[];
}

export interface AskableContextOutputOptions extends AskablePromptContextOptions {
  /** Number of history entries to include. Defaults to 0 (current focus only). */
  history?: number;
  /** Label for the current focus section. Defaults to "Current". */
  currentLabel?: string;
  /** Label for the history section. Defaults to "Recent interactions". */
  historyLabel?: string;
}

export interface AskableContextPacketOptions extends AskablePromptContextOptions {
  /** Override source metadata such as app or route. URL/title/timestamp are inferred in the browser. */
  source?: Partial<WebContextSource>;
  /** Override the capture mode. Defaults to element-focus when focused, otherwise full-page. */
  mode?: WebContextCaptureMode;
  /** User gesture that produced the packet. Inferred from focus source when possible. */
  gesture?: WebContextGesture;
  /** Override the packet target. Useful for region, lasso, circle, and other explicit captures. */
  target?: WebContextTarget;
  /** Optional user intent attached to this capture. */
  intent?: string;
  /** Include visible annotated elements in the packet. Requires context viewport mode. */
  includeViewport?: boolean;
  /** Number of history entries to include. Defaults to 0. */
  history?: number;
  /** Privacy metadata for downstream agents and MCP clients. */
  privacy?: Partial<WebContextPrivacy>;
  /** Provenance metadata for downstream agents and MCP clients. */
  provenance?: Partial<WebContextProvenance>;
}

export interface AskableAsyncContextPacketOptions extends AskableContextPacketOptions {
  /** Sources to include in `surrounding.sources`. Use "all" for every registered source. */
  sources?: 'all' | AskableContextSourceInclude[];
  /** Default source mode when a source request omits mode. Defaults to "summary". */
  sourceMode?: AskableContextSourceMode;
  /** How async packet generation handles failed sources. Defaults to "include". */
  sourceErrorMode?: AskableContextSourceErrorMode;
}

export interface AskableAgentRequestOptions extends AskableAsyncContextOutputOptions {
  /** Stable id for tracing this question through chat transports, logs, and agent runs. */
  requestId?: string;
  /** App-owned metadata copied into the request payload. */
  metadata?: Record<string, unknown>;
  /** Include a structured Context packet. Pass true, packet options, or an existing packet from a capture tool. */
  packet?: boolean | AskableAsyncContextPacketOptions | WebContextPacket;
  /**
   * Build the prompt-ready `context` string from the attached packet target
   * instead of the current focus. Useful for "select first, then ask" composers.
   */
  contextFromPacket?: boolean;
  /**
   * Pass a packet-derived selection payload into registered source resolvers.
   * Explicit `selection` values on individual source requests take precedence.
   */
  selectionFromPacket?: boolean;
}

export interface AskableAgentRequest {
  /** Stable id for tracing, when provided by the app. */
  requestId?: string;
  /** User-authored question or instruction. */
  question: string;
  /** Prompt-ready context string from `toContextAsync()`. */
  context: string;
  /** Serialized current focus at request creation time. */
  focus: AskableSerializedFocus | null;
  /** Structured Context packet when requested. */
  packet?: WebContextPacket;
  /** App-owned metadata copied from request options. */
  metadata?: Record<string, unknown>;
  /** Unix timestamp (ms) when the request payload was created. */
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
  /** Return all annotated elements currently visible in the viewport. */
  getVisibleElements(): AskableFocus[];
  /** Subscribe to an event */
  on<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void;
  /** Unsubscribe from an event */
  off<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void;
  /** Programmatically select an element — use for explicit "Ask AI" buttons */
  select(element: HTMLElement): void;
  /** Set focus from data alone — no DOM element required. Ideal for virtualizing table libraries. */
  push(meta: Record<string, unknown> | string, text?: string, options?: AskablePushOptions): void;
  /** Register an app-owned context source for data not fully represented in the DOM. */
  registerSource(id: string, source: AskableContextSource): AskableContextSourceHandle;
  /** Return true when a context source id is currently registered. */
  hasSource(id: string): boolean;
  /** List registered context sources without resolving their data. */
  listSources(): AskableContextSourceInfo[];
  /** Remove a registered context source. */
  unregisterSource(id: string): boolean;
  /** Notify async subscribers that one source, or all sources, should be re-resolved. */
  notifySourceChanged(id?: string): void;
  /** Resolve one registered source on demand. */
  resolveSource(id: string, request?: Omit<AskableContextSourceRequest, 'id'>): Promise<AskableResolvedContextSource>;
  /** Resolve multiple app-owned context sources as structured data. Defaults to all registered sources. */
  resolveSources(options?: AskableResolveSourcesOptions): Promise<AskableResolvedContextSource[]>;
  /** Reset the current focus to null and emit a 'clear' event */
  clear(): void;
  /** Serialize current focus to structured prompt-ready data */
  serializeFocus(options?: AskablePromptContextOptions): AskableSerializedFocus | null;
  /** Serialize current focus to a prompt-ready string */
  toPromptContext(options?: AskablePromptContextOptions): string;
  /** Serialize current focus plus async app-owned sources to a prompt-ready string. */
  toPromptContextAsync(options?: AskableAsyncPromptContextOptions): Promise<string>;
  /** Serialize focus history to a prompt-ready string (newest first). Optional limit caps the entries returned. */
  toHistoryContext(limit?: number, options?: AskablePromptContextOptions): string;
  /** Serialize visible viewport elements to a prompt-ready string. */
  toViewportContext(options?: AskablePromptContextOptions): string;
  /** Combined current focus + history in a single prompt-ready string */
  toContext(options?: AskableContextOutputOptions): string;
  /** Combined current focus + history + async app-owned sources in a single prompt-ready string. */
  toContextAsync(options?: AskableAsyncContextOutputOptions): Promise<string>;
  /** Serialize current UI state to a structured Context packet for agents and MCP bridges. */
  toContextPacket(options?: AskableContextPacketOptions): WebContextPacket;
  /** Serialize current UI state plus async app-owned sources to a structured Context packet. */
  toContextPacketAsync(options?: AskableAsyncContextPacketOptions): Promise<WebContextPacket>;
  /** Package a user question with source-backed context for chat or agent transports. */
  toAgentRequest(question: string, options?: AskableAgentRequestOptions): Promise<AskableAgentRequest>;
  /** Subscribe to serialized context updates for streaming/chat integrations. Returns an unsubscribe function. */
  subscribe(callback: AskableContextSubscriber, options?: AskableSubscribeOptions): () => void;
  /** Subscribe to source-backed serialized context updates. Stale async resolutions are ignored. */
  subscribeAsync(callback: AskableAsyncContextSubscriber, options?: AskableAsyncSubscribeOptions): () => void;
  /** Clean up all listeners and observers */
  destroy(): void;
}
