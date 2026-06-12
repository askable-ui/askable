import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableConnectionSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateConnectionSourceOptions,
  AskableConnectionStatus,
  AskableConnectionProtocol,
  AskableConnectionSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableConnectionStatus, AskableConnectionProtocol, AskableConnectionSourceSnapshot };

export interface AskableConnectionSourceServiceOptions
  extends Omit<AskableCreateConnectionSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "connection". */
  id?: string;
  /** Underlying transport protocol. @default "websocket" */
  protocol?: AskableConnectionProtocol;
  /** Optional label. */
  label?: string;
  /** Initial status. @default "disconnected" */
  initialStatus?: AskableConnectionStatus;
}

/**
 * Angular service that exposes WebSocket / SSE / polling connection state to AI
 * assistants so they can explain why real-time features aren't updating.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableConnectionSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly connSource = inject(AskableConnectionSourceService);
 *   ngOnInit() {
 *     this.connSource.init({ protocol: 'websocket', label: 'chat' });
 *     this.socket.on('connect', () => this.connSource.setStatus('connected'));
 *     this.socket.on('disconnect', () => this.connSource.setStatus('disconnected'));
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableConnectionSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'connection';
  private _snapshot: AskableConnectionSourceSnapshot | null = null;
  private _protocol: AskableConnectionProtocol = 'websocket';
  private _label: string | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableConnectionSourceSnapshot | null { return this._snapshot; }

  init(options: AskableConnectionSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'connection', protocol = 'websocket', label = null, initialStatus = 'disconnected', describe, kind } = options;
    this._sourceId = id;
    this._protocol = protocol;
    this._label = label ?? null;
    this._snapshot = {
      status: initialStatus,
      isConnected: initialStatus === 'connected',
      isConnecting: initialStatus === 'connecting',
      isReconnecting: initialStatus === 'reconnecting',
      protocol,
      reconnectAttempts: 0,
      connectedAt: null,
      disconnectedAt: null,
      lastError: null,
      label: label ?? null,
    };

    const source = createAskableConnectionSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  setStatus(
    status: AskableConnectionStatus,
    extra: Partial<Pick<AskableConnectionSourceSnapshot, 'reconnectAttempts' | 'lastError'>> = {},
  ): void {
    const now = new Date().toISOString();
    const prev = this._snapshot;
    this._snapshot = {
      status,
      isConnected: status === 'connected',
      isConnecting: status === 'connecting',
      isReconnecting: status === 'reconnecting',
      protocol: prev?.protocol ?? this._protocol,
      reconnectAttempts: extra.reconnectAttempts ?? (status === 'connected' ? 0 : (prev?.reconnectAttempts ?? 0)),
      connectedAt: status === 'connected' ? now : (prev?.connectedAt ?? null),
      disconnectedAt: status === 'disconnected' || status === 'error' ? now : (prev?.disconnectedAt ?? null),
      lastError: extra.lastError ?? (status === 'connected' ? null : (prev?.lastError ?? null)),
      label: prev?.label ?? this._label,
    };
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
