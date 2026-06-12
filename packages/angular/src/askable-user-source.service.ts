import {
  Injectable,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { createAskableUserSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateUserSourceOptions,
  AskableUserProfile,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableUserProfile };

export interface AskableUserSourceServiceOptions
  extends Omit<AskableCreateUserSourceOptions, 'getUser'> {
  /** Source registration id. Defaults to "user". */
  id?: string;
}

/**
 * Angular service that registers a user profile source so AI assistants can
 * personalise responses — addressing users by name, respecting their role
 * and plan, and adapting to their locale.
 *
 * Works with any auth provider: Angular Auth OIDC Client, Auth.js, Clerk, Firebase Auth, etc.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableUserSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly userSource = inject(AskableUserSourceService);
 *   private readonly authService = inject(AuthService);
 *
 *   ngOnInit() {
 *     this.userSource.init({
 *       getUser: () => this.authService.currentUser
 *         ? { name: this.authService.currentUser.displayName, role: this.authService.currentUser.role }
 *         : null,
 *     });
 *   }
 *
 *   onAuthChange() {
 *     this.userSource.notifyChanged();
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableUserSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'user';

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext {
    return this.askable.context;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  init(options: AskableUserSourceServiceOptions & { getUser?: () => AskableUserProfile | null } = {}): void {
    this.unregister();

    const { id = 'user', getUser, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableUserSource({
      ...sourceOptions,
      getUser: getUser ?? (() => null),
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
