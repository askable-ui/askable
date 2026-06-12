import {
  Injectable,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { createAskableSelectionSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateSelectionSourceOptions,
  AskableSelectionSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableSelectionSourceSnapshot };

export interface AskableSelectionSourceServiceOptions
  extends AskableCreateSelectionSourceOptions {
  /** Source registration id. Defaults to "selection". */
  id?: string;
  /**
   * Automatically register a selectionchange listener.
   * @default true
   */
  autoTrack?: boolean;
}

/**
 * Angular service that exposes what text the user has currently selected
 * to AI assistants — so the AI can reference exactly what the user is highlighting.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableSelectionSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly selectionSource = inject(AskableSelectionSourceService);
 *
 *   ngOnInit() {
 *     this.selectionSource.init();
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableSelectionSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'selection';
  private _cleanupListener: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext {
    return this.askable.context;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  init(options: AskableSelectionSourceServiceOptions = {}): void {
    this.unregister();

    const { id = 'selection', autoTrack = true, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableSelectionSource(sourceOptions);
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (autoTrack) {
      const notify = () => this.notifyChanged();
      document.addEventListener('selectionchange', notify);
      this._cleanupListener = () => document.removeEventListener('selectionchange', notify);
    }
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
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
    this._cleanupListener?.();
    this._cleanupListener = null;
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void {
    this.unregister();
  }
}
