import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableFeatureFlagSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateFeatureFlagSourceOptions,
  AskableFeatureFlagValue,
  AskableFeatureFlagSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableFeatureFlagValue, AskableFeatureFlagSourceSnapshot };

export interface AskableFeatureFlagSourceServiceOptions
  extends Omit<AskableCreateFeatureFlagSourceOptions, 'getFlags'> {
  /** Source registration id. Defaults to "feature-flags". */
  id?: string;
}

/**
 * Angular service that exposes feature flag state to AI assistants so they can
 * explain why features are or aren't available.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableFeatureFlagSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly flagSource = inject(AskableFeatureFlagSourceService);
 *
 *   ngOnInit() {
 *     this.flagSource.init({ getFlags: () => this.ldClient.allFlags() });
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableFeatureFlagSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'feature-flags';

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }

  init(options: AskableFeatureFlagSourceServiceOptions & { getFlags: () => Record<string, AskableFeatureFlagValue> | null | undefined }): void {
    this.unregister();
    const { id = 'feature-flags', getFlags, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableFeatureFlagSource({ ...sourceOptions, getFlags });
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
