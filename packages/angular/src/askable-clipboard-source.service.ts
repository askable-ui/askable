import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableClipboardSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateClipboardSourceOptions,
  AskableClipboardEntry,
  AskableClipboardSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableClipboardEntry, AskableClipboardSourceSnapshot };

export interface AskableClipboardSourceServiceOptions
  extends Omit<AskableCreateClipboardSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "clipboard". */
  id?: string;
  /**
   * Maximum number of history entries to retain.
   * @default 10
   */
  maxHistory?: number;
  /**
   * Maximum characters to store per clipboard entry.
   * @default 5000
   */
  maxLength?: number;
  /**
   * Automatically listen to the copy event to capture clipboard contents.
   * @default true
   */
  autoTrack?: boolean;
}

/**
 * Angular service that tracks clipboard copy events and exposes the contents
 * to AI assistants so they can reference what the user has copied.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableClipboardSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly clipboardSource = inject(AskableClipboardSourceService);
 *   ngOnInit() { this.clipboardSource.init(); }
 * }
 * ```
 */
@Injectable()
export class AskableClipboardSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'clipboard';
  private _snapshot: AskableClipboardSourceSnapshot | null = null;
  private _maxHistory = 10;
  private _maxLength = 5000;
  private _cleanup: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableClipboardSourceSnapshot | null { return this._snapshot; }

  init(options: AskableClipboardSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'clipboard', maxHistory = 10, maxLength = 5000, autoTrack = true, describe, kind } = options;
    this._sourceId = id;
    this._maxHistory = maxHistory;
    this._maxLength = maxLength;

    const source = createAskableClipboardSource({ describe, kind, maxHistory, maxLength, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (autoTrack && typeof document !== 'undefined') {
      const handler = (e: ClipboardEvent) => {
        const text = (e.clipboardData?.getData('text/plain') ?? '').slice(0, this._maxLength);
        if (!text) return;
        this._addEntry({ text, copiedAt: new Date().toISOString(), source: 'copy-event' });
      };
      document.addEventListener('copy', handler);
      this._cleanup = () => document.removeEventListener('copy', handler);
    }
  }

  private _addEntry(entry: AskableClipboardEntry): void {
    const history = [entry, ...(this._snapshot?.history ?? [])].slice(0, this._maxHistory);
    this._snapshot = { current: entry, history, total: (this._snapshot?.total ?? 0) + 1 };
    this.notifyChanged();
  }

  addEntry(text: string): void {
    this._addEntry({ text: text.slice(0, this._maxLength), copiedAt: new Date().toISOString(), source: 'clipboard-api' });
  }

  clear(): void {
    this._snapshot = null;
    this.notifyChanged();
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
