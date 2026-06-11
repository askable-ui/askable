import { Injectable, OnDestroy, inject, signal, computed } from '@angular/core';
import { createAskablePageSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreatePageSourceOptions,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export interface AskablePageSourceServiceOptions extends AskableCreatePageSourceOptions {
  /** Source registration id. Defaults to "page". */
  id?: string;
}

/**
 * Angular service that registers a page source capturing the current
 * document title, URL, headings, selected text, and optional links.
 *
 * Automatically uses the root AskableService context. Call init() in
 * ngOnInit to activate, or inject with a config to auto-activate.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskablePageSourceService] })
 * export class MyComponent implements OnInit {
 *   private readonly pageSource = inject(AskablePageSourceService);
 *
 *   ngOnInit() {
 *     this.pageSource.init({ includeLinks: true });
 *   }
 *
 *   async askAI() {
 *     const prompt = await this.pageSource.toPromptContext();
 *   }
 * }
 * ```
 */
@Injectable()
export class AskablePageSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'page';

  readonly isRegistered = signal<boolean>(false);
  readonly kind = computed(() => this.isRegistered() ? 'page' : null);

  get ctx(): AskableContext {
    return this.askable.context;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  init(options: AskablePageSourceServiceOptions = {}): void {
    if (this.handle) {
      this.handle.unregister();
      this.handle = null;
    }

    const { id = 'page', ...pageOptions } = options;
    this._sourceId = id;

    const source = createAskablePageSource(pageOptions);
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  resolve(request?: { mode?: string; maxItems?: number }): Promise<AskableResolvedContextSource> {
    return this.ctx.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.ctx.toPromptContextAsync({
      sources: [{ id: this._sourceId, ...options }],
    });
  }

  notifyChanged(): void {
    this.handle?.notifyChanged();
  }

  unregister(): void {
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void {
    this.unregister();
  }
}
