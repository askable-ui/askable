import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableWindowSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateWindowSourceOptions,
  AskableDeviceCategory,
  AskableOrientation,
  AskableWindowSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableDeviceCategory, AskableOrientation, AskableWindowSourceSnapshot };

export interface AskableWindowSourceServiceOptions extends AskableCreateWindowSourceOptions {
  /** Source registration id. Defaults to "window". */
  id?: string;
  /** Throttle resize events (milliseconds). @default 150 */
  throttleMs?: number;
  /** Automatically listen to resize and orientation change events. @default true */
  autoTrack?: boolean;
}

/**
 * Angular service that exposes viewport dimensions, breakpoint, orientation,
 * and device category to AI assistants.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableWindowSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly windowSource = inject(AskableWindowSourceService);
 *   ngOnInit() { this.windowSource.init(); }
 * }
 * ```
 */
@Injectable()
export class AskableWindowSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'window';
  private _cleanup: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }

  init(options: AskableWindowSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'window', autoTrack = true, throttleMs = 150, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableWindowSource(sourceOptions);
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (autoTrack && typeof window !== 'undefined') {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const notify = () => {
        if (timeoutId) return;
        timeoutId = setTimeout(() => { timeoutId = null; this.notifyChanged(); }, throttleMs);
      };
      window.addEventListener('resize', notify, { passive: true });
      window.addEventListener('orientationchange', notify);
      document.addEventListener('fullscreenchange', notify);
      this._cleanup = () => {
        window.removeEventListener('resize', notify);
        window.removeEventListener('orientationchange', notify);
        document.removeEventListener('fullscreenchange', notify);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
    return this.ctx.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.ctx.toPromptContextAsync({ sources: [{ id: this._sourceId, ...options }] });
  }

  notifyChanged(): void { this.handle?.notifyChanged(); }

  unregister(): void {
    this._cleanup?.();
    this._cleanup = null;
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
