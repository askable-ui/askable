import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableFocusSource, elementToFocusSnapshot } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateFocusSourceOptions,
  AskableFocusedElementSnapshot,
  AskableFocusSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableFocusedElementSnapshot, AskableFocusSourceSnapshot };

export interface AskableFocusSourceServiceOptions
  extends Omit<AskableCreateFocusSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "focus". */
  id?: string;
}

/**
 * Angular service that tracks which element currently has keyboard focus and
 * exposes it to AI assistants so they can provide field-specific assistance.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableFocusSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly focusSource = inject(AskableFocusSourceService);
 *   ngOnInit() { this.focusSource.init(); }
 * }
 * ```
 */
@Injectable()
export class AskableFocusSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'focus';
  private _snapshot: AskableFocusSourceSnapshot | null = null;
  private _changeCount = 0;
  private _cleanup: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableFocusSourceSnapshot | null { return this._snapshot; }

  init(options: AskableFocusSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'focus', describe, kind } = options;
    this._sourceId = id;
    this._changeCount = 0;
    this._snapshot = { focused: null, hasFocus: false, focusChangeCount: 0, lastChangedAt: null };

    const source = createAskableFocusSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (typeof document !== 'undefined') {
      const handleFocusIn = (e: FocusEvent) => {
        const el = e.target as Element | null;
        this._changeCount += 1;
        this._snapshot = { focused: el ? elementToFocusSnapshot(el) : null, hasFocus: el != null, focusChangeCount: this._changeCount, lastChangedAt: new Date().toISOString() };
        this.notifyChanged();
      };

      const handleFocusOut = () => {
        setTimeout(() => {
          const active = document.activeElement;
          if (!active || active === document.body) {
            this._snapshot = { ...this._snapshot!, focused: null, hasFocus: false, lastChangedAt: new Date().toISOString() };
            this.notifyChanged();
          }
        }, 0);
      };

      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);
      this._cleanup = () => {
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
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
