import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableNetworkSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateNetworkSourceOptions,
  AskableNetworkConnectionType,
  AskableNetworkEffectiveType,
  AskableNetworkSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableNetworkConnectionType, AskableNetworkEffectiveType, AskableNetworkSourceSnapshot };

export interface AskableNetworkSourceServiceOptions extends AskableCreateNetworkSourceOptions {
  /** Source registration id. Defaults to "network". */
  id?: string;
  /** Automatically listen to online/offline and connection change events. @default true */
  autoTrack?: boolean;
}

/**
 * Angular service that exposes the device's network status to AI assistants —
 * online/offline, connection type, bandwidth, and latency.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableNetworkSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly networkSource = inject(AskableNetworkSourceService);
 *   ngOnInit() { this.networkSource.init(); }
 * }
 * ```
 */
@Injectable()
export class AskableNetworkSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'network';
  private _cleanup: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }

  init(options: AskableNetworkSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'network', autoTrack = true, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableNetworkSource(sourceOptions);
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (autoTrack && typeof window !== 'undefined') {
      const notify = () => this.notifyChanged();
      window.addEventListener('online', notify);
      window.addEventListener('offline', notify);
      const conn = (navigator as unknown as { connection?: EventTarget }).connection;
      conn?.addEventListener('change', notify);
      this._cleanup = () => {
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
        conn?.removeEventListener('change', notify);
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
