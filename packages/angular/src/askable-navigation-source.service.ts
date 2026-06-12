import {
  Injectable,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { createAskableNavigationSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateNavigationSourceOptions,
  AskableNavigationEntry,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableNavigationEntry };

export interface AskableNavigationSourceServiceOptions
  extends AskableCreateNavigationSourceOptions {
  /** Source registration id. Defaults to "navigation". */
  id?: string;
}

/**
 * Angular service that registers a navigation context source so AI assistants
 * can understand where the user is in the application — current route, page title,
 * route parameters, query string, and navigation history.
 *
 * Integrates with Angular Router by calling `notifyChanged()` in a navigation
 * event subscription.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableNavigationSourceService] })
 * export class AppComponent implements OnInit, OnDestroy {
 *   private readonly navSource = inject(AskableNavigationSourceService);
 *   private readonly router = inject(Router);
 *   private readonly route = inject(ActivatedRoute);
 *   private sub!: Subscription;
 *
 *   ngOnInit() {
 *     this.navSource.init({
 *       getPath: () => this.router.url,
 *       getTitle: () => document.title,
 *     });
 *
 *     this.sub = this.router.events.pipe(
 *       filter(e => e instanceof NavigationEnd)
 *     ).subscribe(() => this.navSource.notifyChanged());
 *   }
 *
 *   ngOnDestroy() { this.sub.unsubscribe(); }
 * }
 * ```
 */
@Injectable()
export class AskableNavigationSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'navigation';

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext {
    return this.askable.context;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  init(options: AskableNavigationSourceServiceOptions = {}): void {
    this.unregister();

    const { id = 'navigation', ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableNavigationSource(sourceOptions);
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
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
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void {
    this.unregister();
  }
}
