import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableNotificationSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateNotificationSourceOptions,
  AskableNotification,
  AskableNotificationSeverity,
  AskableNotificationSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableNotification, AskableNotificationSeverity, AskableNotificationSourceSnapshot };

export interface AskableNotificationSourceServiceOptions
  extends Omit<AskableCreateNotificationSourceOptions, 'getNotifications'> {
  /** Source registration id. Defaults to "notifications". */
  id?: string;
  /**
   * Maximum number of notifications to include in the snapshot.
   * @default 20
   */
  maxNotifications?: number;
}

/**
 * Angular service that tracks active toast messages, banners, and alerts and
 * exposes them to AI assistants so they can acknowledge errors and explain warnings.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableNotificationSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly notifSource = inject(AskableNotificationSourceService);
 *   ngOnInit() { this.notifSource.init(); }
 *   showError(msg: string) {
 *     this.notifSource.add({ id: Date.now().toString(), message: msg, severity: 'error' });
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableNotificationSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'notifications';
  private _notifications: AskableNotification[] = [];

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get notifications(): readonly AskableNotification[] { return this._notifications; }

  init(options: AskableNotificationSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'notifications', maxNotifications = 20, describe, kind } = options;
    this._sourceId = id;
    this._notifications = [];

    const source = createAskableNotificationSource({
      describe,
      kind,
      maxNotifications,
      getNotifications: () => this._notifications,
    });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  add(notification: AskableNotification): void {
    this._notifications = [notification, ...this._notifications];
    this.notifyChanged();
  }

  remove(id: string): void {
    this._notifications = this._notifications.filter((n) => n.id !== id);
    this.notifyChanged();
  }

  clear(): void {
    this._notifications = [];
    this.notifyChanged();
  }

  setNotifications(notifications: AskableNotification[]): void {
    this._notifications = [...notifications];
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
