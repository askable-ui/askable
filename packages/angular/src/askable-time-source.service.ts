import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableTimeSource, buildTimeSnapshot } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableBusinessHoursConfig,
  AskableCreateTimeSourceOptions,
  AskableTimeSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableBusinessHoursConfig, AskableTimeSourceSnapshot };

export interface AskableTimeSourceServiceOptions
  extends Omit<AskableCreateTimeSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "time". */
  id?: string;
  /**
   * How often to update the snapshot in milliseconds.
   * @default 60000 (1 minute)
   */
  intervalMs?: number;
  /** Custom business hours configuration. */
  businessHours?: AskableBusinessHoursConfig;
}

/**
 * Angular service that tracks the current local time, timezone, and business
 * hours status and exposes it to AI assistants so they can give time-aware assistance.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableTimeSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly timeSource = inject(AskableTimeSourceService);
 *   ngOnInit() {
 *     this.timeSource.init({ businessHours: { startHour: 8, endHour: 18 } });
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableTimeSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'time';
  private _snapshot: AskableTimeSourceSnapshot | null = null;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _sessionStart = Date.now();

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableTimeSourceSnapshot | null { return this._snapshot; }

  init(options: AskableTimeSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'time', intervalMs = 60000, businessHours = {}, describe, kind } = options;
    this._sourceId = id;
    this._sessionStart = Date.now();
    this._snapshot = buildTimeSnapshot(businessHours, this._sessionStart);

    const source = createAskableTimeSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    this._timer = setInterval(() => {
      this._snapshot = buildTimeSnapshot(businessHours, this._sessionStart);
      this.notifyChanged();
    }, intervalMs);
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
    return this.ctx.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.ctx.toPromptContextAsync({ sources: [{ id: this._sourceId, ...options }] });
  }

  notifyChanged(): void { this.handle?.notifyChanged(); }

  unregister(): void {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
