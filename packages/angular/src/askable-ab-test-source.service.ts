import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableAbTestSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateAbTestSourceOptions,
  AskableAbTestVariant,
  AskableAbTestSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableAbTestVariant, AskableAbTestSourceSnapshot };

export interface AskableAbTestSourceServiceOptions
  extends Omit<AskableCreateAbTestSourceOptions, 'getExperiments'> {
  /** Source registration id. Defaults to "ab-tests". */
  id?: string;
}

/**
 * Angular service that exposes A/B test variant assignments to AI assistants
 * so they can explain why a user sees a different UI.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableAbTestSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly abSource = inject(AskableAbTestSourceService);
 *
 *   ngOnInit() {
 *     this.abSource.init({
 *       getExperiments: () => [{ experiment: 'checkout_flow', variant: this.variant, isControl: this.variant === 'control' }],
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableAbTestSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'ab-tests';

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }

  init(options: AskableAbTestSourceServiceOptions & { getExperiments: () => AskableAbTestVariant[] | null | undefined }): void {
    this.unregister();
    const { id = 'ab-tests', getExperiments, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableAbTestSource({ ...sourceOptions, getExperiments });
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
