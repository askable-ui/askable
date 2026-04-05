import { Injectable, OnDestroy, signal, computed } from '@angular/core';
import { createAskableContext } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextOptions,
  AskableObserveOptions,
  AskableFocus,
  AskablePromptContextOptions,
} from '@askable-ui/core';

/**
 * Angular service that wraps an AskableContext and exposes reactive signals.
 *
 * Provided at the root injector by default. To use a scoped instance with custom
 * options, provide it at the component level:
 *
 * ```ts
 * @Component({
 *   providers: [{ provide: AskableService, useFactory: () => new AskableService({ textExtractor: ... }) }]
 * })
 * ```
 */
@Injectable({ providedIn: 'root' })
export class AskableService implements OnDestroy {
  private readonly _ctx: AskableContext;
  private readonly _focus = signal<AskableFocus | null>(null);

  /** Reactive signal — current focus or null */
  readonly focus = this._focus.asReadonly();

  /** Computed signal — current focus as a prompt-ready string */
  readonly promptContext = computed(() => {
    this._focus(); // track the focus signal so this updates when focus changes
    return this._ctx.toPromptContext();
  });

  constructor(options?: AskableContextOptions) {
    this._ctx = createAskableContext(options);
    this._ctx.on('focus', (f) => this._focus.set(f));
    this._ctx.on('clear', () => this._focus.set(null));

    if (typeof document !== 'undefined') {
      this._ctx.observe(document);
    }
  }

  /** The underlying AskableContext — for advanced use */
  get ctx(): AskableContext {
    return this._ctx;
  }

  /** Re-observe a specific subtree or change observe options */
  observe(root: HTMLElement | Document = document, options?: AskableObserveOptions): void {
    this._ctx.observe(root, options);
  }

  /** Detach all listeners without destroying the context */
  unobserve(): void {
    this._ctx.unobserve();
  }

  /** Serialize current focus to a prompt-ready string */
  toPromptContext(options?: AskablePromptContextOptions): string {
    return this._ctx.toPromptContext(options);
  }

  ngOnDestroy(): void {
    this._ctx.destroy();
  }
}
