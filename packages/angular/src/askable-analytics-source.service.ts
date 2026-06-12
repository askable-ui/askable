import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableAnalyticsSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateAnalyticsSourceOptions,
  AskableAnalyticsEvent,
  AskableAnalyticsSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableAnalyticsEvent, AskableAnalyticsSourceSnapshot };

export interface AskableAnalyticsSourceServiceOptions
  extends Omit<AskableCreateAnalyticsSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "analytics". */
  id?: string;
  /** Maximum events to retain in history. @default 50 */
  maxEvents?: number;
}

/**
 * Angular service that exposes recent analytics events to AI assistants so they
 * understand the user's journey before asking for help.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableAnalyticsSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly analyticsSource = inject(AskableAnalyticsSourceService);
 *   ngOnInit() { this.analyticsSource.init(); }
 *   onCheckout() { this.analyticsSource.track('checkout_started', { items: 3 }); }
 * }
 * ```
 */
@Injectable()
export class AskableAnalyticsSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'analytics';
  private _snapshot: AskableAnalyticsSourceSnapshot | null = null;
  private _maxEvents = 50;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableAnalyticsSourceSnapshot | null { return this._snapshot; }

  init(options: AskableAnalyticsSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'analytics', maxEvents = 50, describe, kind } = options;
    this._sourceId = id;
    this._maxEvents = maxEvents;

    const source = createAskableAnalyticsSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  track(eventName: string, properties?: Record<string, unknown>): void {
    const entry: AskableAnalyticsEvent = { name: eventName, properties, recordedAt: new Date().toISOString() };
    const existing = this._snapshot?.events ?? [];
    const updated = [entry, ...existing].slice(0, this._maxEvents);
    this._snapshot = { events: updated, total: (this._snapshot?.total ?? 0) + 1, latestEvent: eventName };
    this.notifyChanged();
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
    return this.ctx.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.ctx.toPromptContextAsync({ sources: [{ id: this._sourceId, ...options }] });
  }

  notifyChanged(): void { this.handle?.notifyChanged(); }

  unregister(): void {
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
