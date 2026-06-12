import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskablePermissionSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreatePermissionSourceOptions,
  AskablePermissionEntry,
  AskablePermissionName,
  AskablePermissionState,
  AskablePermissionSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskablePermissionEntry, AskablePermissionName, AskablePermissionState, AskablePermissionSourceSnapshot };

export interface AskablePermissionSourceServiceOptions
  extends Omit<AskableCreatePermissionSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "permissions". */
  id?: string;
  /** Query permissions on init. @default true */
  autoQuery?: boolean;
}

const DEFAULT_PERMISSIONS: AskablePermissionName[] = ['camera', 'microphone', 'notifications', 'geolocation'];

async function queryAll(names: AskablePermissionName[]): Promise<AskablePermissionEntry[]> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return names.map((n) => ({ name: n, state: 'unavailable' as AskablePermissionState }));
  }
  return Promise.all(names.map(async (name) => {
    try {
      const s = await navigator.permissions.query({ name: name as PermissionName });
      return { name, state: s.state as AskablePermissionState };
    } catch {
      return { name, state: 'unavailable' as AskablePermissionState };
    }
  }));
}

function toSnapshot(entries: AskablePermissionEntry[]): AskablePermissionSourceSnapshot {
  const granted: AskablePermissionName[] = [];
  const denied: AskablePermissionName[] = [];
  const prompt: AskablePermissionName[] = [];
  const unavailable: AskablePermissionName[] = [];
  for (const e of entries) {
    if (e.state === 'granted') granted.push(e.name);
    else if (e.state === 'denied') denied.push(e.name);
    else if (e.state === 'prompt') prompt.push(e.name);
    else unavailable.push(e.name);
  }
  return { permissions: entries, granted, denied, prompt, unavailable };
}

/**
 * Angular service that queries browser permission states and exposes them to
 * AI assistants so they can explain why features aren't working.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskablePermissionSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly permSource = inject(AskablePermissionSourceService);
 *   ngOnInit() { this.permSource.init({ permissions: ['camera', 'microphone'] }); }
 * }
 * ```
 */
@Injectable()
export class AskablePermissionSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'permissions';
  private _snapshot: AskablePermissionSourceSnapshot | null = null;
  private _permissions: AskablePermissionName[] = DEFAULT_PERMISSIONS;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskablePermissionSourceSnapshot | null { return this._snapshot; }

  init(options: AskablePermissionSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'permissions', permissions = DEFAULT_PERMISSIONS, autoQuery = true, describe, kind } = options;
    this._sourceId = id;
    this._permissions = permissions;

    const source = createAskablePermissionSource({
      getSnapshot: () => this._snapshot,
      describe,
      kind,
    });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (autoQuery) {
      void this.refresh();
    }
  }

  async refresh(): Promise<void> {
    const entries = await queryAll(this._permissions);
    this._snapshot = toSnapshot(entries);
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
