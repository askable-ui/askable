import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableMultistepSource, buildMultistepSnapshot } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateMultistepSourceOptions,
  AskableMultistepStep,
  AskableMultistepSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableMultistepStep, AskableMultistepSourceSnapshot };

export interface AskableMultistepSourceServiceOptions
  extends Omit<AskableCreateMultistepSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "multistep". */
  id?: string;
  /** Initial step definitions. */
  steps?: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[];
  /** Index of the initially active step. @default 0 */
  initialStep?: number;
}

/**
 * Angular service that tracks wizard, stepper, and checkout flow state and
 * exposes it to AI assistants so they can guide users through multi-step processes.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableMultistepSourceService] })
 * export class CheckoutComponent implements OnInit {
 *   private readonly wizard = inject(AskableMultistepSourceService);
 *   ngOnInit() {
 *     this.wizard.init({
 *       steps: [
 *         { id: 'cart', label: 'Cart' },
 *         { id: 'shipping', label: 'Shipping' },
 *         { id: 'payment', label: 'Payment' },
 *       ],
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableMultistepSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'multistep';
  private _snapshot: AskableMultistepSourceSnapshot | null = null;
  private _startedAt = new Date().toISOString();
  private _initialStepDefs: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[] = [];
  private _initialStep = 0;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableMultistepSourceSnapshot | null { return this._snapshot; }

  init(options: AskableMultistepSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'multistep', steps = [], initialStep = 0, describe, kind } = options;
    this._sourceId = id;
    this._initialStepDefs = steps;
    this._initialStep = initialStep;
    this._startedAt = new Date().toISOString();

    this._snapshot = buildMultistepSnapshot(
      steps.map((s, i) => ({ ...s, completed: false, active: i === initialStep, error: null })),
      { startedAt: this._startedAt },
    );

    const source = createAskableMultistepSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  private _updateSteps(updater: (steps: AskableMultistepStep[]) => AskableMultistepStep[]): void {
    if (!this._snapshot) return;
    const steps = updater([...this._snapshot.steps]);
    this._snapshot = buildMultistepSnapshot(steps, { startedAt: this._snapshot.startedAt });
    this.notifyChanged();
  }

  next(): void {
    this._updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx < 0 || idx >= steps.length - 1) return steps;
      steps[idx] = { ...steps[idx], active: false };
      steps[idx + 1] = { ...steps[idx + 1], active: true };
      return steps;
    });
  }

  prev(): void {
    this._updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx <= 0) return steps;
      steps[idx] = { ...steps[idx], active: false };
      steps[idx - 1] = { ...steps[idx - 1], active: true };
      return steps;
    });
  }

  goTo(index: number): void {
    this._updateSteps((steps) => steps.map((s, i) => ({ ...s, active: i === index })));
  }

  complete(): void {
    this._updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx < 0) return steps;
      steps[idx] = { ...steps[idx], completed: true, active: false, error: null };
      if (idx < steps.length - 1) steps[idx + 1] = { ...steps[idx + 1], active: true };
      return steps;
    });
  }

  setError(error: string | null): void {
    this._updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx < 0) return steps;
      steps[idx] = { ...steps[idx], error };
      return steps;
    });
  }

  reset(): void {
    this._startedAt = new Date().toISOString();
    this._snapshot = buildMultistepSnapshot(
      this._initialStepDefs.map((s, i) => ({ ...s, completed: false, active: i === this._initialStep, error: null })),
      { startedAt: this._startedAt },
    );
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
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
