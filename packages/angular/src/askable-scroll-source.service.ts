import {
  Injectable,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { createAskableScrollSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateScrollSourceOptions,
  AskableScrollState,
  AskableScrollSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableScrollState, AskableScrollSourceSnapshot };

export interface AskableScrollSourceServiceOptions
  extends AskableCreateScrollSourceOptions {
  /** Source registration id. Defaults to "scroll". */
  id?: string;
  /**
   * Throttle scroll events (milliseconds).
   * @default 100
   */
  throttleMs?: number;
}

const SCROLL_EVENTS = ['scroll'] as const;

/**
 * Angular service that exposes scroll position, reading depth, and active section
 * heading to AI assistants — so they know what content the user is looking at.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableScrollSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly scrollSource = inject(AskableScrollSourceService);
 *
 *   ngOnInit() {
 *     this.scrollSource.init({
 *       getActiveSection: () => this.currentHeading,
 *     });
 *     this.scrollSource.attachListeners(window);
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableScrollSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'scroll';
  private _cleanupListeners: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext {
    return this.askable.context;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  init(options: AskableScrollSourceServiceOptions = {}): void {
    this.unregister();

    const { id = 'scroll', throttleMs = 100, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableScrollSource(sourceOptions);
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  /**
   * Attaches a throttled scroll listener to the given target.
   * Returns a cleanup function to remove the listener.
   */
  attachListeners(target: EventTarget = window, throttleMs = 100): () => void {
    this._cleanupListeners?.();

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const notify = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        this.notifyChanged();
      }, throttleMs);
    };

    target.addEventListener('scroll', notify, { passive: true } as AddEventListenerOptions);
    const cleanup = () => {
      target.removeEventListener('scroll', notify);
      if (timeoutId) clearTimeout(timeoutId);
    };
    this._cleanupListeners = cleanup;
    return cleanup;
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
    return this.ctx.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.ctx.toPromptContextAsync({
      sources: [{ id: this._sourceId, ...options }],
    });
  }

  notifyChanged(): void {
    this.handle?.notifyChanged();
  }

  unregister(): void {
    this._cleanupListeners?.();
    this._cleanupListeners = null;
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void {
    this.unregister();
  }
}
