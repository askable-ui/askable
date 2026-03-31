import { Emitter } from './emitter.js';
import { buildFocus, Observer } from './observer.js';
import type {
  AskableContext,
  AskableEventHandler,
  AskableEventName,
  AskableFocus,
  AskableObserveOptions,
  AskablePromptContextOptions,
} from './types.js';

export class AskableContextImpl implements AskableContext {
  private emitter = new Emitter();
  private observer: Observer;
  private currentFocus: AskableFocus | null = null;

  constructor() {
    this.observer = new Observer((focus) => {
      this.currentFocus = focus;
      this.emitter.emit('focus', focus);
    });
  }

  observe(root: HTMLElement | Document, options?: AskableObserveOptions): void {
    this.observer.observe(root, options?.events);
  }

  unobserve(): void {
    this.observer.unobserve();
  }

  getFocus(): AskableFocus | null {
    return this.currentFocus;
  }

  on<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void {
    this.emitter.on(event, handler);
  }

  off<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void {
    this.emitter.off(event, handler);
  }

  select(element: HTMLElement): void {
    const focus = buildFocus(element);
    if (focus) {
      this.currentFocus = focus;
      this.emitter.emit('focus', focus);
    }
  }

  toPromptContext(options?: AskablePromptContextOptions): string {
    const focus = this.currentFocus;
    const format = options?.format ?? 'natural';

    if (!focus) return format === 'json' ? 'null' : 'No UI element is currently focused.';

    const includeText = options?.includeText ?? true;
    const maxTextLength = options?.maxTextLength;
    const textLabel = options?.textLabel ?? 'value';
    const prefix = options?.prefix ?? 'User is focused on:';

    const meta = typeof focus.meta === 'string'
      ? focus.meta
      : this.normalizeMeta(focus.meta, options);

    const text = includeText ? this.normalizeText(focus.text, maxTextLength) : '';

    if (format === 'json') {
      return JSON.stringify({
        meta,
        text: text || undefined,
        timestamp: focus.timestamp,
      });
    }

    const metaStr = typeof meta === 'string'
      ? meta
      : Object.entries(meta).map(([k, v]) => `${k}: ${String(v)}`).join(', ');

    const parts: string[] = [prefix];
    if (metaStr) parts.push(metaStr);
    if (text) parts.push(`${textLabel} "${text}"`);

    return parts.join(' — ');
  }

  destroy(): void {
    this.observer.unobserve();
    this.emitter.clear();
    this.currentFocus = null;
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
}
