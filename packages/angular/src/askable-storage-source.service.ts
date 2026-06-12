import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableStorageSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateStorageSourceOptions,
  AskableStorageSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableStorageSourceSnapshot };

export interface AskableStorageSourceServiceOptions
  extends AskableCreateStorageSourceOptions {
  /** Source registration id. Defaults to "storage". */
  id?: string;
}

/**
 * Angular service that exposes localStorage or sessionStorage items to AI
 * assistants so they can see user preferences, cart contents, and session flags.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableStorageSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly storageSource = inject(AskableStorageSourceService);
 *   ngOnInit() {
 *     this.storageSource.init({ keys: ['cart', 'user_prefs'], omitKeys: ['authToken'] });
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableStorageSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'storage';

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }

  init(options: AskableStorageSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'storage', ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableStorageSource(sourceOptions);
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
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
