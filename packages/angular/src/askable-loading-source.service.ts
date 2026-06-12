import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableLoadingSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateLoadingSourceOptions,
  AskableLoadingStatus,
  AskableLoadingEntry,
  AskableLoadingSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableLoadingStatus, AskableLoadingEntry, AskableLoadingSourceSnapshot };

export interface AskableLoadingSourceServiceOptions
  extends Omit<AskableCreateLoadingSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "loading". */
  id?: string;
}

function buildSnapshot(ops: Map<string, AskableLoadingEntry>): AskableLoadingSourceSnapshot {
  const operations = Array.from(ops.values());
  const loading = operations.filter((o) => o.status === 'loading').map((o) => o.key);
  const loaded = operations.filter((o) => o.status === 'loaded').map((o) => o.key);
  const errored = operations.filter((o) => o.status === 'error').map((o) => o.key);
  return { operations, loading, loaded, errored, isLoading: loading.length > 0, activeCount: loading.length };
}

/**
 * Angular service that tracks named loading operations and exposes them to AI
 * assistants so they can explain why the UI is loading and diagnose slow requests.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableLoadingSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly loadingSource = inject(AskableLoadingSourceService);
 *   ngOnInit() { this.loadingSource.init(); }
 *   async fetchData() {
 *     this.loadingSource.start('users');
 *     try { await api.getUsers(); this.loadingSource.finish('users'); }
 *     catch (e) { this.loadingSource.error('users', e.message); }
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableLoadingSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'loading';
  private _ops = new Map<string, AskableLoadingEntry>();
  private _snapshot: AskableLoadingSourceSnapshot | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableLoadingSourceSnapshot | null { return this._snapshot; }

  init(options: AskableLoadingSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'loading', describe, kind } = options;
    this._sourceId = id;

    const source = createAskableLoadingSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  private _update(): void {
    this._snapshot = buildSnapshot(this._ops);
    this.notifyChanged();
  }

  start(key: string): void {
    this._ops.set(key, { key, status: 'loading', startedAt: new Date().toISOString(), completedAt: null, durationMs: null, error: null });
    this._update();
  }

  finish(key: string): void {
    const existing = this._ops.get(key);
    const now = new Date().toISOString();
    const startedAt = existing?.startedAt ?? now;
    this._ops.set(key, { key, status: 'loaded', startedAt, completedAt: now, durationMs: new Date(now).getTime() - new Date(startedAt).getTime(), error: null });
    this._update();
  }

  error(key: string, message?: string): void {
    const existing = this._ops.get(key);
    const now = new Date().toISOString();
    const startedAt = existing?.startedAt ?? now;
    this._ops.set(key, { key, status: 'error', startedAt, completedAt: now, durationMs: new Date(now).getTime() - new Date(startedAt).getTime(), error: message ?? 'Unknown error' });
    this._update();
  }

  clear(key: string): void {
    this._ops.delete(key);
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
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
