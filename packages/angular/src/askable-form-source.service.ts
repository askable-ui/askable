import {
  ElementRef,
  Injectable,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { createAskableFormSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateFormSourceOptions,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export interface AskableFormSourceServiceOptions
  extends Omit<AskableCreateFormSourceOptions, 'form'> {
  /** Source registration id. Defaults to "form". */
  id?: string;
  /** Angular ElementRef for a form element. Takes precedence over selector. */
  formRef?: ElementRef<HTMLFormElement>;
  /** CSS selector to locate the form. Defaults to the first form in the document. */
  selector?: string;
  /** When true, notifyChanged is called automatically on input/change events. Defaults to true. */
  autoTrack?: boolean;
}

/**
 * Angular service that registers a form source capturing field names, values,
 * types, labels, and HTML5 validation errors so an AI assistant can provide
 * contextual help, suggest corrections, and guide users through multi-step forms.
 *
 * Passwords are masked by default. Use `omitFields` to exclude sensitive fields.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableFormSourceService] })
 * export class CheckoutComponent implements OnInit, OnDestroy {
 *   \@ViewChild('checkoutForm') formRef!: ElementRef<HTMLFormElement>;
 *   private readonly formSource = inject(AskableFormSourceService);
 *   private readonly agent = inject(AskableAgentService);
 *
 *   ngAfterViewInit() {
 *     this.formSource.init({ formRef: this.formRef, omitFields: ['csrf'] });
 *   }
 *
 *   async getHelp() {
 *     const result = await this.agent.send('Help me fill in this form', async (req) => {
 *       const res = await fetch('/api/form-help', {
 *         method: 'POST',
 *         body: JSON.stringify(req),
 *       });
 *       return res.json();
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableFormSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'form';
  private _cleanup: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext {
    return this.askable.context;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  init(options: AskableFormSourceServiceOptions = {}): void {
    this.unregister();

    const {
      id = 'form',
      formRef,
      selector,
      autoTrack = true,
      ...formOptions
    } = options;

    this._sourceId = id;

    const source = createAskableFormSource({
      ...formOptions,
      form: formRef ? () => formRef.nativeElement : selector,
    });

    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (autoTrack) {
      this._setupAutoTrack(formRef, selector);
    }
  }

  private _setupAutoTrack(
    formRef?: ElementRef<HTMLFormElement>,
    selector?: string,
  ): void {
    const resolveEl = () =>
      formRef?.nativeElement ??
      (selector
        ? document.querySelector<HTMLFormElement>(selector)
        : document.querySelector<HTMLFormElement>('form'));

    const form = resolveEl();
    if (!form) return;

    const handleChange = () => this.notifyChanged();
    form.addEventListener('input', handleChange);
    form.addEventListener('change', handleChange);

    this._cleanup = () => {
      form.removeEventListener('input', handleChange);
      form.removeEventListener('change', handleChange);
    };
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
    this._cleanup?.();
    this._cleanup = null;
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void {
    this.unregister();
  }
}
