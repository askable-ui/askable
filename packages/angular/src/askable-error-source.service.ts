import {
  Injectable,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { createAskableErrorSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateErrorSourceOptions,
  AskableErrorEntry,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableErrorEntry };

export interface AskableErrorSourceServiceOptions
  extends Omit<AskableCreateErrorSourceOptions, 'getErrors'> {
  /** Source registration id. Defaults to "errors". */
  id?: string;
}

/**
 * Angular service that registers an error source exposing application error state —
 * form validation errors, API failure messages, caught exceptions — so an AI assistant
 * can diagnose problems and guide the user to resolution.
 *
 * Compatible with Angular Reactive Forms, third-party validators, or any custom error structure.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableErrorSourceService] })
 * export class LoginComponent implements OnInit {
 *   private readonly errorSource = inject(AskableErrorSourceService);
 *   formErrors = signal<Record<string, string>>({});
 *
 *   ngOnInit() {
 *     this.errorSource.init({
 *       getErrors: () => Object.entries(this.formErrors()).map(([key, message]) => ({ key, message })),
 *     });
 *   }
 *
 *   onSubmit() {
 *     if (!valid) {
 *       this.formErrors.set({ email: 'Invalid email' });
 *       this.errorSource.notifyChanged();
 *     }
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableErrorSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'errors';

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext {
    return this.askable.context;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  init(options: AskableErrorSourceServiceOptions & { getErrors?: () => AskableErrorEntry[] } = {}): void {
    this.unregister();

    const { id = 'errors', getErrors, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableErrorSource({
      ...sourceOptions,
      getErrors: getErrors ?? (() => []),
    });

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
