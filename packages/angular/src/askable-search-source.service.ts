import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableSearchSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateSearchSourceOptions,
  AskableSearchSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableSearchSourceSnapshot };

export interface AskableSearchSourceServiceOptions
  extends Omit<AskableCreateSearchSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "search". */
  id?: string;
  /** Initial query string. */
  initialQuery?: string;
}

/**
 * Angular service that tracks active search state and exposes it to AI
 * assistants so they can explain empty results and suggest alternatives.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableSearchSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly searchSource = inject(AskableSearchSourceService);
 *   ngOnInit() { this.searchSource.init(); }
 *   onSearch(q: string) {
 *     this.searchSource.setQuery(q);
 *     this.searchSource.setSearching(true);
 *     this.api.search(q).subscribe((results) => {
 *       this.searchSource.setResults(results.total);
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableSearchSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'search';
  private _snapshot: AskableSearchSourceSnapshot | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableSearchSourceSnapshot | null { return this._snapshot; }

  init(options: AskableSearchSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'search', initialQuery = '', describe, kind } = options;
    this._sourceId = id;
    this._snapshot = { query: initialQuery, isSearching: false, resultCount: null, hasNoResults: false, filters: {}, sort: null, page: null, searchedAt: null };

    const source = createAskableSearchSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  private _patch(update: Partial<AskableSearchSourceSnapshot>): void {
    this._snapshot = { ...this._snapshot!, ...update };
    this.notifyChanged();
  }

  setQuery(query: string): void { this._patch({ query, resultCount: null, hasNoResults: false, searchedAt: null }); }
  setResults(count: number): void { this._patch({ resultCount: count, hasNoResults: count === 0, isSearching: false, searchedAt: new Date().toISOString() }); }
  setSearching(searching: boolean): void { this._patch({ isSearching: searching }); }
  setFilters(filters: Record<string, string | string[]>): void { this._patch({ filters, resultCount: null, hasNoResults: false }); }
  setSort(sort: AskableSearchSourceSnapshot['sort']): void { this._patch({ sort, resultCount: null, hasNoResults: false }); }
  reset(): void { this._snapshot = { query: '', isSearching: false, resultCount: null, hasNoResults: false, filters: {}, sort: null, page: null, searchedAt: null }; this.notifyChanged(); }

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
