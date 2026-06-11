import { Injectable, OnDestroy, signal } from '@angular/core';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextOptions, AskableEvent, AskableFocus } from '@askable-ui/core';

export interface AskableServiceOptions extends AskableContextOptions {
  events?: AskableEvent[];
}

@Injectable({ providedIn: 'root' })
export class AskableService implements OnDestroy {
  private readonly ctx: AskableContext;
  private readonly focusHandler = (f: AskableFocus) => this.focus.set(f);
  private readonly clearHandler = (_: null) => {
    this.focus.set(null);
    this.promptContext.set('');
  };

  readonly focus = signal<AskableFocus | null>(null);
  readonly promptContext = signal<string>('');

  constructor() {
    this.ctx = createAskableContext();
    if (typeof document !== 'undefined') {
      this.ctx.observe(document);
    }
    this.ctx.on('focus', this.focusHandler);
    this.ctx.on('clear', this.clearHandler);
    this.ctx.on('focus', () => {
      this.promptContext.set(this.ctx.toPromptContext());
    });
  }

  /** Access the raw AskableContext for advanced usage (sources, region capture, etc.) */
  get context(): AskableContext {
    return this.ctx;
  }

  ngOnDestroy(): void {
    this.ctx.off('focus', this.focusHandler);
    this.ctx.off('clear', this.clearHandler);
    this.ctx.destroy();
  }
}
