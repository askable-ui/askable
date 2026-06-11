import { Injectable, OnDestroy, signal, computed } from '@angular/core';
import type { AskableContext, AskableFocus } from '@askable-ui/core';

export interface AskableHistoryServiceOptions {
  maxEntries?: number;
  dedupe?: boolean;
}

@Injectable()
export class AskableHistoryService implements OnDestroy {
  private readonly _history = signal<AskableFocus[]>([]);

  readonly history = computed(() => this._history());
  readonly current = computed(() => this._history()[0] ?? null);

  readonly promptContext = computed(() => {
    const entries = this._history();
    if (entries.length === 0) return 'No navigation history.';
    const lines = entries.map((f) => {
      const metaStr =
        typeof f.meta === 'string'
          ? f.meta
          : Object.keys(f.meta as object).length > 0
            ? JSON.stringify(f.meta)
            : null;
      return `→ ${metaStr ?? f.text}`;
    });
    return `User navigation trail (most recent first):\n${lines.join('\n')}`;
  });

  private maxEntries: number = 10;
  private dedupe: boolean = true;
  private offHandler: (() => void) | null = null;

  /** Wire to an AskableContext to start tracking focus changes */
  init(ctx: AskableContext, options?: AskableHistoryServiceOptions): void {
    this.maxEntries = options?.maxEntries ?? 10;
    this.dedupe = options?.dedupe ?? true;
    this.offHandler?.();
    const handler = (focus: AskableFocus) => this.push(focus);
    ctx.on('focus', handler);
    this.offHandler = () => ctx.off('focus', handler);
  }

  /** Manually push a focus entry */
  push(focus: AskableFocus): void {
    const key = typeof focus.meta === 'string' ? focus.meta : focus.text;
    this._history.update((prev) => {
      const prevKey = prev[0]
        ? (typeof prev[0].meta === 'string' ? prev[0].meta : prev[0].text)
        : null;
      if (this.dedupe && prevKey === key) return prev;
      return [focus, ...prev].slice(0, this.maxEntries);
    });
  }

  clear(): void {
    this._history.set([]);
  }

  ngOnDestroy(): void {
    this.offHandler?.();
    this.offHandler = null;
  }
}
