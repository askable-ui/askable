import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableTabSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateTabSourceOptions,
  AskableTabSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableTabSourceSnapshot };

export interface AskableTabSourceServiceOptions
  extends Omit<AskableCreateTabSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "tab". */
  id?: string;
}

function getVisibility(): 'visible' | 'hidden' | 'prerender' {
  if (typeof document === 'undefined') return 'visible';
  return (document.visibilityState as 'visible' | 'hidden' | 'prerender') ?? 'visible';
}

/**
 * Angular service that tracks browser tab visibility using the Page Visibility
 * API and exposes it to AI assistants so they understand when users switch away.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableTabSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly tabSource = inject(AskableTabSourceService);
 *   ngOnInit() { this.tabSource.init(); }
 * }
 * ```
 */
@Injectable()
export class AskableTabSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'tab';
  private _snapshot: AskableTabSourceSnapshot | null = null;
  private _hideCount = 0;
  private _hiddenSince: string | null = null;
  private _visibleSince: string | null = null;
  private _cleanup: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableTabSourceSnapshot | null { return this._snapshot; }

  init(options: AskableTabSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'tab', describe, kind } = options;
    this._sourceId = id;

    const vis = getVisibility();
    this._visibleSince = vis === 'visible' ? new Date().toISOString() : null;
    this._hiddenSince = vis === 'hidden' ? new Date().toISOString() : null;
    this._hideCount = 0;
    this._snapshot = {
      visibility: vis,
      isVisible: vis === 'visible',
      isHidden: vis === 'hidden',
      visibleSince: this._visibleSince,
      hiddenSince: this._hiddenSince,
      hideCount: 0,
      hiddenSeconds: 0,
    };

    const source = createAskableTabSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (typeof document !== 'undefined') {
      const handler = () => this._onVisibilityChange();
      document.addEventListener('visibilitychange', handler);
      this._cleanup = () => document.removeEventListener('visibilitychange', handler);
    }
  }

  private _onVisibilityChange(): void {
    const v = getVisibility();
    const now = new Date().toISOString();
    if (v === 'hidden') {
      this._hideCount += 1;
      this._hiddenSince = now;
      this._visibleSince = null;
    } else {
      this._hiddenSince = null;
      this._visibleSince = now;
    }
    const hiddenSeconds = this._hiddenSince
      ? Math.floor((Date.now() - new Date(this._hiddenSince).getTime()) / 1000)
      : 0;
    this._snapshot = {
      visibility: v,
      isVisible: v === 'visible',
      isHidden: v === 'hidden',
      visibleSince: this._visibleSince,
      hiddenSince: this._hiddenSince,
      hideCount: this._hideCount,
      hiddenSeconds,
    };
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
    this._cleanup?.();
    this._cleanup = null;
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
