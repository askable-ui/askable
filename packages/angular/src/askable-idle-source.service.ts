import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableIdleSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateIdleSourceOptions,
  AskableIdleSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableIdleSourceSnapshot };

export interface AskableIdleSourceServiceOptions
  extends Omit<AskableCreateIdleSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "idle". */
  id?: string;
  /** Milliseconds of inactivity before idle. @default 300000 (5 min) */
  idleAfterMs?: number;
  /** DOM events that reset the idle timer. */
  activityEvents?: string[];
  /** Automatically listen to activity events. @default true */
  autoTrack?: boolean;
}

const DEFAULT_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

/**
 * Angular service that detects user idleness and exposes the state to AI
 * assistants so they can understand session inactivity.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableIdleSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly idleSource = inject(AskableIdleSourceService);
 *   ngOnInit() { this.idleSource.init({ idleAfterMs: 5 * 60 * 1000 }); }
 * }
 * ```
 */
@Injectable()
export class AskableIdleSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'idle';
  private _snapshot: AskableIdleSourceSnapshot | null = null;
  private _lastActive = Date.now();
  private _idleAfterMs = 5 * 60 * 1000;
  private _cleanup: (() => void) | null = null;
  private _timer: ReturnType<typeof setInterval> | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableIdleSourceSnapshot | null { return this._snapshot; }

  init(options: AskableIdleSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'idle', idleAfterMs = 5 * 60 * 1000, activityEvents = DEFAULT_EVENTS, autoTrack = true, describe, kind } = options;
    this._sourceId = id;
    this._idleAfterMs = idleAfterMs;
    this._lastActive = Date.now();

    this._snapshot = { isIdle: false, isActive: true, lastActiveAt: new Date().toISOString(), idleSeconds: 0, secondsSinceActive: 0 };

    const source = createAskableIdleSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (autoTrack && typeof window !== 'undefined') {
      const handler = () => this.markActive();
      activityEvents.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
      this._timer = setInterval(() => this._update(), 5000);
      this._cleanup = () => {
        activityEvents.forEach((ev) => window.removeEventListener(ev, handler));
        if (this._timer) clearInterval(this._timer);
      };
    }
  }

  private _update(): void {
    const now = Date.now();
    const msSince = now - this._lastActive;
    const isIdle = msSince >= this._idleAfterMs;
    const secondsSinceActive = Math.floor(msSince / 1000);
    this._snapshot = { isIdle, isActive: !isIdle, lastActiveAt: new Date(this._lastActive).toISOString(), idleSeconds: isIdle ? secondsSinceActive : 0, secondsSinceActive };
    this.notifyChanged();
  }

  markActive(): void {
    this._lastActive = Date.now();
    this._update();
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
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
