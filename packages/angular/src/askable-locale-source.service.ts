import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableLocaleSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateLocaleSourceOptions,
  AskableLocaleSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableLocaleSourceSnapshot };

export interface AskableLocaleSourceServiceOptions extends AskableCreateLocaleSourceOptions {
  /** Source registration id. Defaults to "locale". */
  id?: string;
}

/**
 * Angular service that exposes the user's locale, timezone, date format, and
 * currency to AI assistants.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableLocaleSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly localeSource = inject(AskableLocaleSourceService);
 *   ngOnInit() { this.localeSource.init(); }
 * }
 * ```
 */
@Injectable()
export class AskableLocaleSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'locale';

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }

  init(options: AskableLocaleSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'locale', ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableLocaleSource(sourceOptions);
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
