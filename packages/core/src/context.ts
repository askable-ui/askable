import { createWebContextPacket, isWebContextPacket } from '@askable-ui/context';
import { Emitter } from './emitter.js';
import { buildFocus, Observer } from './observer.js';
import type {
  AskableContext,
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableAsyncContextSubscriber,
  AskableAsyncContextPacketOptions,
  AskableContextOptions,
  AskableContextOutputOptions,
  AskableContextPacketOptions,
  AskableAsyncContextOutputOptions,
  AskableAsyncPromptContextOptions,
  AskableContextSubscriber,
  AskableContextSource,
  AskableContextSourceHandle,
  AskableContextSourceInclude,
  AskableContextSourceInfo,
  AskableContextSourceMode,
  AskableContextSourceRequest,
  AskableContextSourceChange,
  AskableResolveSourcesOptions,
  AskableEventHandler,
  AskableEventName,
  AskableFocus,
  AskableFocusSegment,
  AskableObserveOptions,
  AskablePacketSourceSelection,
  AskablePromptContextOptions,
  AskablePromptPreset,
  AskablePushOptions,
  AskableResolvedContextSource,
  AskableSerializedFocus,
  AskableSerializedFocusSegment,
  AskableAsyncSubscribeOptions,
  AskableSubscribeOptions,
} from './types.js';
import type {
  WebContextCaptureMode,
  WebContextGesture,
  WebContextPacket,
  WebContextRect,
  WebContextSource,
  WebContextTarget,
} from '@askable-ui/context';

const PRESETS: Record<AskablePromptPreset, AskablePromptContextOptions> = {
  compact: { includeText: false, format: 'natural' },
  verbose: { includeText: true, format: 'natural' },
  json: { format: 'json', includeText: true },
};

const DEFAULT_MAX_HISTORY = 50;

type AskableContextSourceEntry = {
  source: AskableContextSource;
  token: symbol;
  registeredAt: number;
  updatedAt: number;
};

export class AskableContextImpl implements AskableContext {
  private emitter = new Emitter();
  private observer: Observer;
  private currentFocus: AskableFocus | null = null;
  private history: AskableFocus[] = [];
  private visibleElements = new Set<HTMLElement>();
  private intersectionObserver: IntersectionObserver | null = null;
  private viewportEnabled: boolean;
  private maxHistory: number;
  private sources = new Map<string, AskableContextSourceEntry>();
  private textExtractor: ((el: HTMLElement) => string) | undefined;
  private sanitizeMetaFn: ((meta: Record<string, unknown>) => Record<string, unknown>) | undefined;
  private sanitizeTextFn: ((text: string) => string) | undefined;
  private sanitizeSourceFn: ((source: AskableResolvedContextSource) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>) | undefined;
  private subscriptions = new Set<() => void>();

  constructor(options?: AskableContextOptions) {
    this.textExtractor = options?.textExtractor;
    this.sanitizeMetaFn = options?.sanitizeMeta;
    this.sanitizeTextFn = options?.sanitizeText;
    this.sanitizeSourceFn = options?.sanitizeSource;
    this.viewportEnabled = options?.viewport ?? false;
    const maxHistory = options?.maxHistory ?? DEFAULT_MAX_HISTORY;
    if (!Number.isInteger(maxHistory) || maxHistory < 0) {
      throw new RangeError('maxHistory must be a non-negative integer');
    }
    this.maxHistory = maxHistory;
    this.observer = new Observer((rawFocus) => {
      const focus = this.applySanitizers(rawFocus);
      this.currentFocus = focus;
      if (this.maxHistory > 0) {
        this.history.push(focus);
        if (this.history.length > this.maxHistory) this.history.shift();
      }
      this.emitter.emit('focus', focus);
    }, this.textExtractor, {
      onAttach: (el) => this.intersectionObserver?.observe(el),
      onDetach: (el) => {
        this.intersectionObserver?.unobserve(el);
        this.visibleElements.delete(el);
      },
    });
  }

  private applySanitizers(focus: AskableFocus): AskableFocus {
    if (!this.sanitizeMetaFn && !this.sanitizeTextFn) return focus;
    const meta = this.sanitizeMetaFn && typeof focus.meta !== 'string'
      ? this.sanitizeMetaFn(focus.meta)
      : focus.meta;
    const text = this.sanitizeTextFn ? this.sanitizeTextFn(focus.text) : focus.text;
    const ancestors = focus.ancestors?.map((segment) => ({
      ...segment,
      meta: this.sanitizeMetaFn && typeof segment.meta !== 'string'
        ? this.sanitizeMetaFn(segment.meta)
        : segment.meta,
      text: this.sanitizeTextFn ? this.sanitizeTextFn(segment.text) : segment.text,
    }));
    return { ...focus, meta, ...(ancestors?.length ? { ancestors } : {}), text };
  }

  private matchesScope(focus: AskableFocus | null, scope?: string): focus is AskableFocus {
    if (!focus) return false;
    if (!scope) return true;
    return focus.scope === undefined || focus.scope === scope;
  }

  private filterByScope(focuses: AskableFocus[], scope?: string): AskableFocus[] {
    if (!scope) return focuses;
    return focuses.filter((focus) => this.matchesScope(focus, scope));
  }

  private resolveHierarchyElements(focus: AskableFocus, scope?: string): HTMLElement[] {
    if (!focus.element) return [];

    const visited = new Set<HTMLElement>([focus.element]);
    const ancestors: HTMLElement[] = [];
    let current: HTMLElement | null = focus.element;

    while (current) {
      const explicitParent = this.resolveExplicitHierarchyParent(current);
      const parent: HTMLElement | null = explicitParent ?? current.parentElement?.closest('[data-askable]') ?? null;
      if (!parent || visited.has(parent)) break;
      visited.add(parent);
      const parentFocus = buildFocus(parent, this.textExtractor);
      if (parentFocus && this.matchesScope(parentFocus, scope)) {
        ancestors.push(parent);
      }
      current = parent;
    }

    return ancestors.reverse();
  }

  private resolveExplicitHierarchyParent(el: HTMLElement): HTMLElement | null {
    const selector = el.getAttribute('data-askable-parent')?.trim();
    if (!selector) return null;
    const rootNode = el.getRootNode();
    const queryRoot = typeof (rootNode as ParentNode).querySelector === 'function'
      ? rootNode as ParentNode
      : document;
    try {
      const candidate = queryRoot.querySelector(selector);
      return candidate instanceof HTMLElement && candidate !== el && candidate.hasAttribute('data-askable')
        ? candidate
        : null;
    } catch {
      return null;
    }
  }

  private limitHierarchyDepth(elements: HTMLElement[], depth?: number): HTMLElement[] {
    if (depth === undefined) return elements;
    if (depth <= 0) return [];
    return elements.slice(-depth);
  }

  private formatFocusMeta(meta: Record<string, unknown> | string): string {
    return typeof meta === 'string'
      ? meta
      : Object.entries(meta).map(([k, v]) => `${k}: ${this.formatMetaValue(v)}`).join(', ');
  }

  private filterAncestorSegments(segments: AskableFocusSegment[] | undefined, scope?: string): AskableFocusSegment[] {
    if (!segments || segments.length === 0) return [];
    if (!scope) return segments;
    return segments.filter((segment) => segment.scope === undefined || segment.scope === scope);
  }

  private limitAncestorSegments(segments: AskableFocusSegment[] | undefined, depth?: number): AskableFocusSegment[] {
    if (!segments || segments.length === 0) return [];
    if (depth === undefined) return segments;
    if (depth <= 0) return [];
    return segments.slice(-depth);
  }

  private serializeFocusSegment(
    segment: AskableFocusSegment,
    options?: AskablePromptContextOptions
  ): AskableSerializedFocusSegment {
    const resolved = this.resolveOptions(options);
    const includeText = resolved.includeText ?? true;
    const maxTextLength = resolved.maxTextLength;
    const meta = typeof segment.meta === 'string'
      ? segment.meta
      : this.normalizeMeta(segment.meta, resolved);
    const text = includeText ? this.normalizeText(segment.text, maxTextLength) : '';

    return {
      meta,
      ...(segment.scope ? { scope: segment.scope } : {}),
      ...(text ? { text } : {}),
    };
  }

  observe(root: HTMLElement | Document, options?: AskableObserveOptions): void {
    if (this.viewportEnabled && typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver?.disconnect();
      this.visibleElements.clear();
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            this.visibleElements.add(el);
          } else {
            this.visibleElements.delete(el);
          }
        });
      });
    }

    this.observer.observe(
      root,
      options?.events,
      options?.hoverDebounce ?? 0,
      options?.hoverThrottle ?? 0,
      options?.targetStrategy ?? 'deepest'
    );
  }

  unobserve(): void {
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.visibleElements.clear();
    this.observer.unobserve();
  }

  getFocus(): AskableFocus | null {
    return this.currentFocus;
  }

  getHistory(limit?: number): AskableFocus[] {
    const hist = this.history.slice().reverse();
    return limit !== undefined ? hist.slice(0, limit) : hist;
  }

  getVisibleElements(): AskableFocus[] {
    return Array.from(this.visibleElements)
      .map((el) => buildFocus(el, this.textExtractor))
      .filter((focus): focus is AskableFocus => Boolean(focus))
      .map((focus) => this.applySanitizers(focus));
  }

  on<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void {
    this.emitter.on(event, handler);
  }

  off<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void {
    this.emitter.off(event, handler);
  }

  select(element: HTMLElement): void {
    const rawFocus = buildFocus(element, this.textExtractor);
    if (!rawFocus) return;
    const focus = this.applySanitizers({ ...rawFocus, source: 'select' });
    this.currentFocus = focus;
    if (this.maxHistory > 0) {
      this.history.push(focus);
      if (this.history.length > this.maxHistory) this.history.shift();
    }
    this.emitter.emit('focus', focus);
  }

  push(meta: Record<string, unknown> | string, text?: string, options?: AskablePushOptions): void {
    const sanitizedMeta = this.sanitizeMetaFn && typeof meta !== 'string'
      ? this.sanitizeMetaFn(meta) : meta;
    const sanitizedText = this.sanitizeTextFn
      ? this.sanitizeTextFn(text ?? '')
      : (text ?? '');
    const sanitizedAncestors = options?.ancestors?.map((seg) => ({
      ...seg,
      meta: this.sanitizeMetaFn && typeof seg.meta !== 'string'
        ? this.sanitizeMetaFn(seg.meta)
        : seg.meta,
      text: this.sanitizeTextFn ? this.sanitizeTextFn(seg.text) : seg.text,
    }));
    const focus: AskableFocus = {
      source: 'push',
      meta: sanitizedMeta,
      ...(options?.scope ? { scope: options.scope } : {}),
      ...(sanitizedAncestors?.length ? { ancestors: sanitizedAncestors } : {}),
      text: sanitizedText,
      timestamp: Date.now(),
    };
    this.currentFocus = focus;
    if (this.maxHistory > 0) {
      this.history.push(focus);
      if (this.history.length > this.maxHistory) this.history.shift();
    }
    this.emitter.emit('focus', focus);
  }

  registerSource(id: string, source: AskableContextSource): AskableContextSourceHandle {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('Askable context source id must be a non-empty string.');
    }
    const token = Symbol(normalizedId);
    const now = Date.now();
    this.sources.set(normalizedId, {
      source,
      token,
      registeredAt: now,
      updatedAt: now,
    });
    this.notifySourceChanged(normalizedId);
    return {
      id: normalizedId,
      notifyChanged: () => {
        this.notifySourceHandleChanged(normalizedId, token);
      },
      unregister: () => {
        this.unregisterSourceHandle(normalizedId, token);
      },
    };
  }

  hasSource(id: string): boolean {
    return this.sources.has(id.trim());
  }

  listSources(): AskableContextSourceInfo[] {
    return Array.from(this.sources.entries()).map(([id, entry]) => ({
      id,
      ...(entry.source.kind ? { kind: entry.source.kind } : {}),
      registeredAt: entry.registeredAt,
      updatedAt: entry.updatedAt,
    }));
  }

  unregisterSource(id: string): boolean {
    const normalizedId = id.trim();
    const deleted = this.sources.delete(normalizedId);
    if (deleted) this.notifySourceChanged(normalizedId);
    return deleted;
  }

  private unregisterSourceHandle(id: string, token: symbol): boolean {
    const entry = this.sources.get(id);
    if (!entry || entry.token !== token) return false;
    this.sources.delete(id);
    this.notifySourceChanged(id);
    return true;
  }

  private notifySourceHandleChanged(id: string, token: symbol): void {
    const entry = this.sources.get(id);
    if (entry?.token !== token) return;
    this.notifySourceChanged(id);
  }

  notifySourceChanged(id?: string): void {
    const normalizedId = id?.trim();
    const timestamp = Date.now();
    if (normalizedId) {
      const entry = this.sources.get(normalizedId);
      if (entry) entry.updatedAt = timestamp;
    } else {
      this.sources.forEach((entry) => {
        entry.updatedAt = timestamp;
      });
    }
    this.emitter.emit('sourcechange', {
      ...(normalizedId ? { id: normalizedId } : {}),
      timestamp,
    });
  }

  async resolveSource(
    id: string,
    request?: Omit<AskableContextSourceRequest, 'id'>
  ): Promise<AskableResolvedContextSource> {
    const sourceId = id.trim();
    const entry = this.sources.get(sourceId);
    if (!entry) {
      throw new Error(`Askable context source "${sourceId}" is not registered.`);
    }
    const { source } = entry;

    const mode = request?.mode ?? 'summary';
    const signal = request?.signal;
    const [description, state, data] = await Promise.all([
      this.runSourceTask(() => this.resolveSourceDescription(source), request?.timeoutMs, signal),
      source.getState ? this.runSourceTask(() => source.getState!(), request?.timeoutMs, signal) : undefined,
      source.resolve ? this.runSourceTask(() => source.resolve!({
          sourceId,
          mode,
          focus: this.currentFocus,
          selection: request?.selection,
          maxItems: request?.maxItems,
          maxTokens: request?.maxTokens,
          timeoutMs: request?.timeoutMs,
          signal,
        }), request?.timeoutMs, signal) : undefined,
    ]);

    const resolved: AskableResolvedContextSource = {
      id: sourceId,
      ...(source.kind ? { kind: source.kind } : {}),
      ...(description ? { description } : {}),
      mode,
      ...(state !== undefined ? { state } : {}),
      ...(data !== undefined ? { data } : {}),
    };
    return this.applySourceSanitizers(resolved, source);
  }

  async resolveSources(options?: AskableResolveSourcesOptions): Promise<AskableResolvedContextSource[]> {
    return this.resolveIncludedSources({
      ...options,
      sources: options?.sources ?? 'all',
    });
  }

  clear(): void {
    this.currentFocus = null;
    this.emitter.emit('clear', null);
  }

  serializeFocus(options?: AskablePromptContextOptions): AskableSerializedFocus | null {
    const resolved = this.resolveOptions(options);
    if (!this.matchesScope(this.currentFocus, resolved.scope)) return null;
    return this.serializeFocusFrom(this.currentFocus, resolved);
  }

  toPromptContext(options?: AskablePromptContextOptions): string {
    const resolved = this.resolveOptions(options);
    const focus = this.matchesScope(this.currentFocus, resolved.scope) ? this.currentFocus : null;
    const output = this.buildPromptString(focus, resolved);
    return this.applyTokenBudget(output, resolved.maxTokens);
  }

  async toPromptContextAsync(options?: AskableAsyncPromptContextOptions): Promise<string> {
    const resolved = this.resolveOptions(options);
    const { maxTokens, ...baseOptions } = resolved;
    const base = this.toPromptContext(baseOptions);
    const sources = await this.resolveIncludedSources(options);
    if (sources.length === 0) return this.applyTokenBudget(base, maxTokens);
    const output = this.appendSourcesToOutput(base, sources, resolved, options?.sourceLabel);
    return this.applyTokenBudget(output, maxTokens);
  }

  toHistoryContext(limit?: number, options?: AskablePromptContextOptions): string {
    const resolved = this.resolveOptions(options);
    const history = this.filterByScope(this.getHistory(limit), resolved.scope);
    if (history.length === 0) return 'No interaction history.';
    const lines = history.map((focus, i) => `[${i + 1}] ${this.buildPromptString(focus, resolved)}`);
    const output = lines.join('\n');
    return this.applyTokenBudget(output, resolved.maxTokens);
  }

  toViewportContext(options?: AskablePromptContextOptions): string {
    const resolved = this.resolveOptions(options);
    const visible = this.filterByScope(this.getVisibleElements(), resolved.scope);
    if (visible.length === 0) return resolved.format === 'json' ? '[]' : 'No annotated UI elements are currently visible.';
    if (resolved.format === 'json') {
      return JSON.stringify(visible.map((focus) => this.serializeFocusFrom(focus, resolved)));
    }
    const lines = visible.map((focus, i) => `[${i + 1}] ${this.buildPromptString(focus, resolved)}`);
    return this.applyTokenBudget(lines.join('\n'), resolved.maxTokens);
  }

  toContext(options?: AskableContextOutputOptions): string {
    const { history: historyCount = 0, currentLabel = 'Current', historyLabel = 'Recent interactions', ...promptOptions } = options ?? {};
    const resolved = this.resolveOptions(promptOptions);

    const currentFocus = this.matchesScope(this.currentFocus, resolved.scope) ? this.currentFocus : null;
    const currentLine = `${currentLabel}: ${this.buildPromptString(currentFocus, resolved)}`;

    if (historyCount <= 0) {
      return this.applyTokenBudget(currentLine, resolved.maxTokens);
    }

    const historyEntries = this.filterByScope(this.getHistory(historyCount), resolved.scope);
    if (historyEntries.length === 0) {
      return this.applyTokenBudget(currentLine, resolved.maxTokens);
    }

    const historyLines = historyEntries
      .map((focus, i) => `[${i + 1}] ${this.buildPromptString(focus, resolved)}`);
    const output = `${currentLine}\n\n${historyLabel}:\n${historyLines.join('\n')}`;
    return this.applyTokenBudget(output, resolved.maxTokens);
  }

  async toContextAsync(options?: AskableAsyncContextOutputOptions): Promise<string> {
    return this.toContextAsyncWithSourceSelection(options);
  }

  private async toContextAsyncWithSourceSelection(
    options?: AskableAsyncContextOutputOptions,
    defaultSourceSelection?: unknown
  ): Promise<string> {
    const resolved = this.resolveOptions(options);
    const { sources: _sources, sourceMode: _sourceMode, sourceLabel, maxTokens, ...contextOptions } = options ?? {};
    const base = this.toContext(contextOptions);
    const sources = await this.resolveIncludedSources(options, defaultSourceSelection);
    if (sources.length === 0) return this.applyTokenBudget(base, maxTokens);
    const output = this.appendSourcesToOutput(base, sources, resolved, sourceLabel);
    return this.applyTokenBudget(output, maxTokens);
  }

  toContextPacket(options?: AskableContextPacketOptions): WebContextPacket {
    const resolved = this.resolveOptions(options);
    const currentFocus = this.matchesScope(this.currentFocus, resolved.scope) ? this.currentFocus : null;
    const historyCount = options?.history ?? 0;
    const history = historyCount > 0
      ? this.filterByScope(this.getHistory(historyCount), resolved.scope).map((focus) => this.focusToTarget(focus, resolved))
      : [];
    const visible = options?.includeViewport
      ? this.filterByScope(this.getVisibleElements(), resolved.scope).map((focus) => this.focusToTarget(focus, resolved))
      : [];
    const ancestors = currentFocus ? this.focusAncestorsToTargets(currentFocus, resolved) : [];

    const target = options?.target ?? (currentFocus ? this.focusToTarget(currentFocus, resolved) : undefined);

    return createWebContextPacket({
      source: this.resolvePacketSource(options?.source),
      capture: {
        mode: options?.mode ?? this.resolveCaptureMode(currentFocus),
        gesture: options?.gesture ?? this.resolveGesture(currentFocus),
        ...(options?.intent ? { intent: options.intent } : {}),
      },
      ...(target ? { target } : {}),
      ...((ancestors.length > 0 || history.length > 0 || visible.length > 0) ? {
        surrounding: {
          ...(ancestors.length > 0 ? { ancestors } : {}),
          ...(visible.length > 0 ? { visible } : {}),
          ...(history.length > 0 ? { history } : {}),
        },
      } : {}),
      privacy: {
        redacted: Boolean(this.sanitizeMetaFn || this.sanitizeTextFn),
        consent: 'implicit',
        ...options?.privacy,
      },
      provenance: {
        producer: '@askable-ui/core',
        method: currentFocus?.source === 'push' ? 'manual' : 'app',
        ...options?.provenance,
      },
    });
  }

  async toContextPacketAsync(options?: AskableAsyncContextPacketOptions): Promise<WebContextPacket> {
    const { sources: _sources, sourceMode: _sourceMode, sourceErrorMode: _sourceErrorMode, ...packetOptions } = options ?? {};
    const packet = this.toContextPacket(packetOptions);
    const sources = await this.resolveIncludedSources(options);
    if (sources.length === 0) return packet;

    return {
      ...packet,
      surrounding: {
        ...packet.surrounding,
        sources: sources.map((source) => this.sourceToTarget(source)),
      },
    };
  }

  async toAgentRequest(question: string, options?: AskableAgentRequestOptions): Promise<AskableAgentRequest> {
    const {
      requestId,
      metadata,
      packet: packetOption,
      contextFromPacket = false,
      selectionFromPacket = false,
      ...contextOptions
    } = options ?? {};
    let packet: WebContextPacket | undefined;
    if (packetOption) {
      if (packetOption === true) {
        packet = await this.toContextPacketAsync(this.agentRequestOptionsToPacketOptions(contextOptions));
      } else if (isWebContextPacket(packetOption)) {
        packet = packetOption;
      } else {
        packet = await this.toContextPacketAsync(packetOption);
      }
    }
    const defaultSourceSelection = selectionFromPacket && packet
      ? this.packetToSourceSelection(packet)
      : undefined;
    const context = contextFromPacket && packet
      ? await this.toPacketContextAsync(packet, contextOptions, defaultSourceSelection)
      : await this.toContextAsyncWithSourceSelection(contextOptions, defaultSourceSelection);

    return {
      ...(requestId ? { requestId } : {}),
      question,
      context,
      focus: this.serializeFocus(contextOptions),
      ...(packet ? { packet } : {}),
      ...(metadata ? { metadata } : {}),
      timestamp: Date.now(),
    };
  }

  subscribe(callback: AskableContextSubscriber, options?: AskableSubscribeOptions): () => void {
    const { debounce = 0, ...contextOptions } = options ?? {};
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const emitContext = () => {
      if (!active) return;
      const focus = this.currentFocus;
      const scopedFocus = this.matchesScope(focus, contextOptions.scope) ? focus : null;
      callback(this.toContext(contextOptions), scopedFocus);
    };

    const schedule = () => {
      if (!active) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (debounce > 0) {
        timer = setTimeout(() => {
          timer = null;
          emitContext();
        }, debounce);
        return;
      }
      emitContext();
    };

    const onFocus = () => schedule();
    const onClear = () => schedule();

    this.on('focus', onFocus);
    this.on('clear', onClear);

    const unsubscribe = () => {
      if (!active) return;
      active = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      this.off('focus', onFocus);
      this.off('clear', onClear);
      this.subscriptions.delete(unsubscribe);
    };

    this.subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  subscribeAsync(callback: AskableAsyncContextSubscriber, options?: AskableAsyncSubscribeOptions): () => void {
    const {
      debounce = 0,
      emitInitial = false,
      onError,
      ...contextOptions
    } = options ?? {};
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    let version = 0;

    const reportError = (error: unknown, scheduledVersion: number) => {
      if (!active || scheduledVersion !== version) return;
      onError?.(error);
    };

    const emitContext = async (scheduledVersion: number) => {
      if (!active) return;
      try {
        const focus = this.currentFocus;
        const scopedFocus = this.matchesScope(focus, contextOptions.scope) ? focus : null;
        const context = await this.toContextAsync(contextOptions);
        if (!active || scheduledVersion !== version) return;
        await callback(context, scopedFocus);
      } catch (error) {
        reportError(error, scheduledVersion);
      }
    };

    const schedule = () => {
      if (!active) return;
      version += 1;
      const scheduledVersion = version;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (debounce > 0) {
        timer = setTimeout(() => {
          timer = null;
          void emitContext(scheduledVersion);
        }, debounce);
        return;
      }
      void emitContext(scheduledVersion);
    };

    const onFocus = () => schedule();
    const onClear = () => schedule();
    const onSourceChange = (change: AskableContextSourceChange) => {
      if (this.shouldRefreshSources(contextOptions.sources, change.id)) schedule();
    };

    this.on('focus', onFocus);
    this.on('clear', onClear);
    this.on('sourcechange', onSourceChange);
    if (emitInitial) schedule();

    const unsubscribe = () => {
      if (!active) return;
      active = false;
      version += 1;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      this.off('focus', onFocus);
      this.off('clear', onClear);
      this.off('sourcechange', onSourceChange);
      this.subscriptions.delete(unsubscribe);
    };

    this.subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  destroy(): void {
    this.unobserve();
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.clear();
    this.emitter.clear();
    this.currentFocus = null;
    this.history = [];
    this.visibleElements.clear();
    this.sources.clear();
  }

  private async resolveSourceDescription(source: AskableContextSource): Promise<string | undefined> {
    if (!source.describe) return undefined;
    return typeof source.describe === 'function' ? source.describe() : source.describe;
  }

  private async runSourceTask<T>(
    task: () => T | Promise<T>,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<T> {
    if (signal?.aborted) {
      throw new Error('Context source request aborted.');
    }

    const value = Promise.resolve().then(task);
    if (timeoutMs === undefined) return value;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Context source timed out.'));
      }, Math.max(0, timeoutMs));

      const abort = () => {
        clearTimeout(timer);
        reject(new Error('Context source request aborted.'));
      };

      signal?.addEventListener('abort', abort, { once: true });
      value.then(
        (result) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
          resolve(result);
        },
        (error) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
          reject(error);
        },
      );
    });
  }

  private async applySourceSanitizers(
    resolved: AskableResolvedContextSource,
    source: AskableContextSource
  ): Promise<AskableResolvedContextSource> {
    const sourceSanitized = source.sanitize ? await source.sanitize(resolved) : resolved;
    return this.sanitizeSourceFn ? this.sanitizeSourceFn(sourceSanitized) : sourceSanitized;
  }

  private normalizeSourceRequest(
    include: AskableContextSourceInclude,
    defaultMode: AskableContextSourceMode,
    defaultSelection?: unknown
  ): AskableContextSourceRequest {
    if (typeof include === 'string') {
      return {
        id: include,
        mode: defaultMode,
        ...(defaultSelection !== undefined ? { selection: defaultSelection } : {}),
      };
    }
    return {
      ...include,
      mode: include.mode ?? defaultMode,
      ...(include.selection === undefined && defaultSelection !== undefined ? { selection: defaultSelection } : {}),
    };
  }

  private shouldRefreshSources(
    includes: 'all' | AskableContextSourceInclude[] | undefined,
    changedId?: string
  ): boolean {
    if (!includes) return false;
    if (!changedId) return true;
    if (includes === 'all') return true;
    return includes.some((include) => (
      typeof include === 'string'
        ? include.trim() === changedId
        : include.id.trim() === changedId
    ));
  }

  private async resolveIncludedSources(
    options?: AskableAsyncPromptContextOptions | AskableAsyncContextOutputOptions,
    defaultSelection?: unknown
  ): Promise<AskableResolvedContextSource[]> {
    const includes = options?.sources;
    if (!includes) return [];
    const defaultMode = options.sourceMode ?? 'summary';
    const requests = includes === 'all'
      ? Array.from(this.sources.keys()).map((id) => ({
          id,
          mode: defaultMode,
          ...(defaultSelection !== undefined ? { selection: defaultSelection } : {}),
        }))
      : includes.map((include) => this.normalizeSourceRequest(include, defaultMode, defaultSelection));

    const errorMode = options.sourceErrorMode ?? 'include';
    const resolved = await Promise.all(requests.map(({ id, ...request }) => (
      this.resolveSource(id, request).catch((error) => {
        if (errorMode === 'throw') throw error;
        if (errorMode === 'omit') return null;
        return this.buildSourceError(id, request.mode ?? defaultMode);
      })
    )));

    return resolved.filter((source): source is AskableResolvedContextSource => Boolean(source));
  }

  private buildSourceError(
    id: string,
    mode: AskableContextSourceMode
  ): AskableResolvedContextSource {
    return {
      id,
      mode,
      error: {
        message: 'Context source unavailable.',
      },
    };
  }

  private appendSourcesToOutput(
    base: string,
    sources: AskableResolvedContextSource[],
    options: AskablePromptContextOptions,
    label = 'Context sources',
    jsonBaseKey = 'focus'
  ): string {
    if ((options.format ?? 'natural') === 'json') {
      return JSON.stringify({
        [jsonBaseKey]: this.safeParseJson(base),
        sources,
      });
    }

    const sourceOutput = sources
      .map((source, index) => `[${index + 1}] ${this.formatResolvedSource(source)}`)
      .join('\n');
    return `${base}\n\n${label}:\n${sourceOutput}`;
  }

  private formatResolvedSource(source: AskableResolvedContextSource): string {
    const heading = [
      source.id,
      source.kind ? `kind: ${source.kind}` : '',
      `mode: ${source.mode}`,
      source.description ? `description: ${source.description}` : '',
    ].filter(Boolean).join(' — ');
    const parts = [heading];
    if (source.state !== undefined) parts.push(`state ${this.stringifySourceValue(source.state)}`);
    if (source.data !== undefined) parts.push(`data ${this.stringifySourceValue(source.data)}`);
    if (source.error) parts.push(`error "${source.error.message}"`);
    return parts.join(' — ');
  }

  private stringifySourceValue(value: unknown): string {
    if (typeof value === 'string') return `"${value}"`;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private formatMetaValue(value: unknown): string {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private safeParseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private normalizeMeta(
    meta: Record<string, unknown>,
    options?: AskablePromptContextOptions
  ): Record<string, unknown> {
    const exclude = new Set(options?.excludeKeys ?? []);
    const entries = Object.entries(meta).filter(([key]) => !exclude.has(key));
    const keyOrder = options?.keyOrder ?? [];

    if (keyOrder.length === 0) return Object.fromEntries(entries);

    const ordered = [...entries].sort(([a], [b]) => {
      const ai = keyOrder.indexOf(a);
      const bi = keyOrder.indexOf(b);
      const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (aRank !== bRank) return aRank - bRank;
      return 0;
    });

    return Object.fromEntries(ordered);
  }

  private focusToTarget(focus: AskableFocus, options?: AskablePromptContextOptions): WebContextTarget {
    const serialized = this.serializeFocusFrom(focus, options);
    const element = focus.element;
    const target: WebContextTarget = {
      metadata: serialized.meta,
      ...(serialized.text ? { text: serialized.text } : {}),
      ...(focus.scope ? { role: focus.scope } : {}),
    };

    if (element) {
      const label = element.getAttribute('aria-label') ?? element.getAttribute('title') ?? undefined;
      const role = element.getAttribute('role') ?? target.role;
      const selector = this.buildElementSelector(element);
      const bounds = this.getElementBounds(element);
      if (label) target.label = label;
      if (role) target.role = role;
      if (selector) target.selector = selector;
      if (bounds) target.bounds = bounds;
    }

    return target;
  }

  private focusAncestorsToTargets(focus: AskableFocus, options?: AskablePromptContextOptions): WebContextTarget[] {
    const resolved = this.resolveOptions(options);
    return this.limitAncestorSegments(
      this.filterAncestorSegments(focus.ancestors, resolved.scope),
      resolved.hierarchyDepth,
    ).map((segment) => ({
      metadata: typeof segment.meta === 'string' ? segment.meta : this.normalizeMeta(segment.meta, resolved),
      ...(segment.scope ? { role: segment.scope } : {}),
      ...(resolved.includeText ?? true ? { text: this.normalizeText(segment.text, resolved.maxTextLength) } : {}),
    }));
  }

  private sourceToTarget(source: AskableResolvedContextSource): WebContextTarget {
    return {
      label: source.id,
      ...(source.kind ? { role: source.kind } : {}),
      ...(source.description ? { text: source.description } : {}),
      metadata: {
        id: source.id,
        mode: source.mode,
        ...(source.state !== undefined ? { state: source.state } : {}),
        ...(source.data !== undefined ? { data: source.data } : {}),
        ...(source.error ? { error: source.error } : {}),
      },
    };
  }

  private agentRequestOptionsToPacketOptions(
    options: AskableAsyncContextOutputOptions
  ): AskableAsyncContextPacketOptions {
    const {
      currentLabel: _currentLabel,
      historyLabel: _historyLabel,
      sourceLabel: _sourceLabel,
      ...packetOptions
    } = options;
    return packetOptions;
  }

  private async toPacketContextAsync(
    packet: WebContextPacket,
    options: AskableAsyncContextOutputOptions,
    defaultSourceSelection?: unknown
  ): Promise<string> {
    const resolved = this.resolveOptions(options);
    const { sourceLabel, maxTokens } = options ?? {};
    const currentLabel = options.currentLabel ?? 'Current';
    const packetContext = this.buildPacketPromptString(packet, resolved);
    const base = (resolved.format ?? 'natural') === 'json'
      ? packetContext
      : `${currentLabel}: ${packetContext}`;
    const sources = await this.resolveIncludedSources(options, defaultSourceSelection);
    const output = sources.length === 0
      ? base
      : this.appendSourcesToOutput(base, sources, resolved, sourceLabel, 'packet');
    return this.applyTokenBudget(output, maxTokens);
  }

  private packetToSourceSelection(packet: WebContextPacket): AskablePacketSourceSelection {
    const target = packet.target;
    return {
      capture: packet.capture,
      source: packet.source,
      ...(target ? {
        target: {
          ...(target.label ? { label: target.label } : {}),
          ...(target.role ? { role: target.role } : {}),
          ...(target.selector ? { selector: target.selector } : {}),
          ...(target.bounds ? { bounds: target.bounds } : {}),
          ...(target.text ? { text: target.text } : {}),
          ...(target.metadata !== undefined ? { metadata: target.metadata } : {}),
        },
      } : {}),
    };
  }

  private resolveCaptureMode(focus: AskableFocus | null): WebContextCaptureMode {
    if (!focus) return 'full-page';
    if (focus.source === 'push') return 'semantic';
    return 'element-focus';
  }

  private resolveGesture(focus: AskableFocus | null): WebContextGesture | undefined {
    if (!focus) return undefined;
    if (focus.source === 'select' || focus.source === 'push') return 'programmatic';
    return 'focus';
  }

  private resolvePacketSource(source?: Partial<WebContextSource>): Partial<WebContextSource> {
    const inferred: Partial<WebContextSource> = {};
    if (typeof document !== 'undefined') {
      inferred.title = document.title || undefined;
    }
    if (typeof window !== 'undefined') {
      inferred.url = window.location?.href;
      inferred.route = window.location?.pathname;
    }
    return { ...inferred, ...source };
  }

  private getElementBounds(element: HTMLElement): WebContextRect | undefined {
    if (typeof element.getBoundingClientRect !== 'function') return undefined;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  private buildElementSelector(element: HTMLElement): string | undefined {
    if (element.id) return `#${this.escapeSelectorIdent(element.id)}`;
    const askableId = element.getAttribute('data-askable-id')?.trim();
    if (askableId) return `[data-askable-id="${this.escapeAttributeValue(askableId)}"]`;
    if (element.hasAttribute('data-askable')) {
      const sameTagAskables = Array.from(element.ownerDocument.querySelectorAll(element.tagName.toLowerCase()))
        .filter((candidate) => candidate.hasAttribute('data-askable'));
      const index = sameTagAskables.indexOf(element);
      if (index >= 0) {
        return `${element.tagName.toLowerCase()}[data-askable]:nth-of-type(${index + 1})`;
      }
    }
    return undefined;
  }

  private escapeSelectorIdent(value: string): string {
    const css = globalThis.CSS as { escape?: (value: string) => string } | undefined;
    return css?.escape ? css.escape(value) : value.replace(/["'\\#.:,[\]>~+*()]/g, '\\$&');
  }

  private escapeAttributeValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private normalizeText(text: string, maxTextLength?: number): string {
    if (maxTextLength === undefined) return text;
    return text.slice(0, Math.max(0, maxTextLength));
  }

  private buildPromptString(focus: AskableFocus | null, options?: AskablePromptContextOptions): string {
    const resolved = this.resolveOptions(options);
    const format = resolved.format ?? 'natural';
    const serialized = focus ? this.serializeFocusFrom(focus, resolved) : null;

    if (!serialized) return format === 'json' ? 'null' : 'No UI element is currently focused.';

    if (format === 'json') {
      return JSON.stringify(serialized);
    }

    const textLabel = resolved.textLabel ?? 'value';
    const prefix = resolved.prefix ?? 'User is focused on:';
    const ancestorSegments = focus?.ancestors?.length
      ? this.limitAncestorSegments(this.filterAncestorSegments(focus.ancestors, resolved.scope), resolved.hierarchyDepth)
      : focus
        ? this.limitHierarchyDepth(this.resolveHierarchyElements(focus, resolved.scope), resolved.hierarchyDepth)
          .map((element) => buildFocus(element, this.textExtractor))
          .filter((item): item is AskableFocus => Boolean(item))
          .map((item) => ({
            meta: typeof item.meta === 'string' ? item.meta : this.normalizeMeta(item.meta, resolved),
            ...(item.scope ? { scope: item.scope } : {}),
            ...(item.text ? { text: this.normalizeText(item.text, resolved.maxTextLength) } : {}),
          }))
        : [];
    const hierarchyPrefix = ancestorSegments
      .map((segment) => this.formatFocusMeta(segment.meta))
      .join(' > ');

    const metaStr = this.formatFocusMeta(serialized.meta);
    const metaWithHierarchy = hierarchyPrefix ? `${hierarchyPrefix} > ${metaStr}` : metaStr;

    const parts: string[] = [prefix];
    if (metaWithHierarchy) parts.push(metaWithHierarchy);
    if (serialized.text) parts.push(`${textLabel} "${serialized.text}"`);

    return parts.join(' — ');
  }

  private buildPacketPromptString(packet: WebContextPacket, options?: AskablePromptContextOptions): string {
    const resolved = this.resolveOptions(options);
    const format = resolved.format ?? 'natural';
    const target = packet.target ?? null;

    if (format === 'json') {
      return JSON.stringify({
        capture: packet.capture,
        target,
        ...(packet.surrounding ? { surrounding: packet.surrounding } : {}),
        privacy: packet.privacy,
        provenance: packet.provenance,
      });
    }

    if (!target) return 'No packet target is available.';

    const prefix = resolved.prefix ?? 'User selected context:';
    const textLabel = resolved.textLabel ?? 'value';
    const metadata = typeof target.metadata === 'string'
      ? target.metadata
      : target.metadata
        ? this.normalizeMeta(target.metadata, resolved)
        : undefined;
    const metaStr = metadata ? this.formatFocusMeta(metadata) : '';
    const text = target.text && (resolved.includeText ?? true)
      ? this.normalizeText(target.text, resolved.maxTextLength)
      : '';
    const bounds = target.bounds
      ? `bounds: ${Math.round(target.bounds.width)}x${Math.round(target.bounds.height)} at ${Math.round(target.bounds.x)},${Math.round(target.bounds.y)}`
      : '';

    const parts: string[] = [prefix];
    if (packet.capture.mode) parts.push(`capture: ${packet.capture.mode}`);
    if (target.label) parts.push(`label: ${target.label}`);
    if (target.role) parts.push(`role: ${target.role}`);
    if (metaStr) parts.push(metaStr);
    if (text) parts.push(`${textLabel} "${text}"`);
    if (bounds) parts.push(bounds);

    return parts.join(' — ');
  }

  private serializeFocusFrom(focus: AskableFocus, options?: AskablePromptContextOptions): AskableSerializedFocus {
    const resolved = this.resolveOptions(options);
    const includeText = resolved.includeText ?? true;
    const maxTextLength = resolved.maxTextLength;

    const meta = typeof focus.meta === 'string'
      ? focus.meta
      : this.normalizeMeta(focus.meta, resolved);
    const ancestors = this.limitAncestorSegments(
      this.filterAncestorSegments(focus.ancestors, resolved.scope),
      resolved.hierarchyDepth,
    ).map((segment) => this.serializeFocusSegment(segment, resolved));

    const text = includeText ? this.normalizeText(focus.text, maxTextLength) : '';

    return {
      meta,
      ...(focus.scope ? { scope: focus.scope } : {}),
      ...(ancestors.length ? { ancestors } : {}),
      ...(text ? { text } : {}),
      timestamp: focus.timestamp,
    };
  }

  private resolveOptions(options?: AskablePromptContextOptions): AskablePromptContextOptions {
    if (!options?.preset) return options ?? {};
    const { preset, ...rest } = options;
    return { ...PRESETS[preset], ...rest };
  }

  private applyTokenBudget(output: string, maxTokens?: number): string {
    if (maxTokens === undefined) return output;
    const budget = maxTokens * 4;
    if (output.length <= budget) return output;
    const marker = '... [truncated]';
    return output.slice(0, Math.max(0, budget - marker.length)) + marker;
  }
}
