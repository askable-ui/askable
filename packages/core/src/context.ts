import { Emitter } from './emitter.js';
import { buildFocus, Observer } from './observer.js';
import type {
  AskableContext,
  AskableContextOptions,
  AskableEventHandler,
  AskableEventName,
  AskableFocus,
  AskableObserveOptions,
  AskablePromptContextOptions,
  AskablePromptPreset,
  AskableSerializedFocus,
} from './types.js';

const PRESETS: Record<AskablePromptPreset, AskablePromptContextOptions> = {
  compact: { includeText: false, format: 'natural' },
  verbose: { includeText: true, format: 'natural' },
  json: { format: 'json', includeText: true },
};

const MAX_HISTORY = 50;

export class AskableContextImpl implements AskableContext {
  private emitter = new Emitter();
  private observer: Observer;
  private currentFocus: AskableFocus | null = null;
  private history: AskableFocus[] = [];
  private textExtractor: ((el: HTMLElement) => string) | undefined;

  constructor(options?: AskableContextOptions) {
    this.textExtractor = options?.textExtractor;
    this.observer = new Observer((focus) => {
      this.currentFocus = focus;
      this.history.push(focus);
      if (this.history.length > MAX_HISTORY) this.history.shift();
      this.emitter.emit('focus', focus);
    }, this.textExtractor);
  }

  observe(root: HTMLElement | Document, options?: AskableObserveOptions): void {
    this.observer.observe(
      root,
      options?.events,
      options?.hoverDebounce ?? 0,
      options?.hoverThrottle ?? 0
    );
  }

  unobserve(): void {
    this.observer.unobserve();
  }

  getFocus(): AskableFocus | null {
    return this.currentFocus;
  }

  getHistory(limit?: number): AskableFocus[] {
    const hist = this.history.slice().reverse();
    return limit !== undefined ? hist.slice(0, limit) : hist;
  }

  on<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void {
    this.emitter.on(event, handler);
  }

  off<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void {
    this.emitter.off(event, handler);
  }

  select(element: HTMLElement): void {
    const focus = buildFocus(element, this.textExtractor);
    if (focus) {
      this.currentFocus = focus;
      this.history.push(focus);
      if (this.history.length > MAX_HISTORY) this.history.shift();
      this.emitter.emit('focus', focus);
    }
  }

  clear(): void {
    this.currentFocus = null;
    this.emitter.emit('clear', null);
  }

  serializeFocus(options?: AskablePromptContextOptions): AskableSerializedFocus | null {
    if (!this.currentFocus) return null;
    return this.serializeFocusFrom(this.currentFocus, this.resolveOptions(options));
  }

  toPromptContext(options?: AskablePromptContextOptions): string {
    const resolved = this.resolveOptions(options);
    const output = this.buildPromptString(this.currentFocus, resolved);
    return this.applyTokenBudget(output, resolved.maxTokens);
  }

  toHistoryContext(limit?: number, options?: AskablePromptContextOptions): string {
    const resolved = this.resolveOptions(options);
    const history = this.getHistory(limit);
    if (history.length === 0) return 'No interaction history.';
    const lines = history.map((focus, i) => `[${i + 1}] ${this.buildPromptString(focus, resolved)}`);
    const output = lines.join('\n');
    return this.applyTokenBudget(output, resolved.maxTokens);
  }

  destroy(): void {
    this.observer.unobserve();
    this.emitter.clear();
    this.currentFocus = null;
    this.history = [];
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

    const metaStr = typeof serialized.meta === 'string'
      ? serialized.meta
      : Object.entries(serialized.meta).map(([k, v]) => `${k}: ${String(v)}`).join(', ');

    const parts: string[] = [prefix];
    if (metaStr) parts.push(metaStr);
    if (serialized.text) parts.push(`${textLabel} "${serialized.text}"`);

    return parts.join(' — ');
  }

  private serializeFocusFrom(focus: AskableFocus, options?: AskablePromptContextOptions): AskableSerializedFocus {
    const resolved = this.resolveOptions(options);
    const includeText = resolved.includeText ?? true;
    const maxTextLength = resolved.maxTextLength;

    const meta = typeof focus.meta === 'string'
      ? focus.meta
      : this.normalizeMeta(focus.meta, resolved);

    const text = includeText ? this.normalizeText(focus.text, maxTextLength) : '';

    return {
      meta,
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
