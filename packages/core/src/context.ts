import { Emitter } from './emitter.js';
import { Observer } from './observer.js';
import type {
  AskableContext,
  AskableEventHandler,
  AskableEventName,
  AskableFocus,
  AskableObserveOptions,
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

  toPromptContext(): string {
    const focus = this.currentFocus;
    if (!focus) return 'No UI element is currently focused.';

    const meta = focus.meta;
    let metaStr = '';

    if (typeof meta === 'string') {
      metaStr = meta;
    } else {
      const parts = Object.entries(meta).map(([k, v]) => `${k}: ${String(v)}`);
      metaStr = parts.join(', ');
    }

    const parts: string[] = ['User is focused on:'];
    if (metaStr) parts.push(metaStr);
    if (focus.text) parts.push(`value "${focus.text}"`);

    return parts.join(' — ');
  }

  destroy(): void {
    this.observer.unobserve();
    this.emitter.clear();
    this.currentFocus = null;
  }
}
