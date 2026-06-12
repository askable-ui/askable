import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableBatterySource, getBatteryStatus, formatDuration } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateBatterySourceOptions,
  AskableBatterySourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableBatterySourceSnapshot };

export interface AskableBatterySourceServiceOptions
  extends Omit<AskableCreateBatterySourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "battery". */
  id?: string;
}

type BatteryManager = {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  addEventListener(event: string, handler: () => void): void;
  removeEventListener(event: string, handler: () => void): void;
};

/**
 * Angular service that subscribes to the Battery Status API and exposes device
 * battery level and charging state to AI assistants so they can warn users
 * before starting long tasks when battery is low.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableBatterySourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly batterySource = inject(AskableBatterySourceService);
 *   ngOnInit() { this.batterySource.init(); }
 * }
 * ```
 */
@Injectable()
export class AskableBatterySourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'battery';
  private _snapshot: AskableBatterySourceSnapshot | null = null;
  private _battery: BatteryManager | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableBatterySourceSnapshot | null { return this._snapshot; }

  init(options: AskableBatterySourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'battery', describe, kind } = options;
    this._sourceId = id;

    const source = createAskableBatterySource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    const nav = (typeof navigator !== 'undefined' ? navigator : null) as (Navigator & { getBattery?: () => Promise<BatteryManager> }) | null;
    if (nav?.getBattery) {
      nav.getBattery().then((battery) => {
        this._battery = battery;
        this._update();
        battery.addEventListener('levelchange', () => this._update());
        battery.addEventListener('chargingchange', () => this._update());
        battery.addEventListener('chargingtimechange', () => this._update());
        battery.addEventListener('dischargingtimechange', () => this._update());
      }).catch(() => undefined);
    }
  }

  private _update(): void {
    const b = this._battery;
    if (!b) return;
    const level = Math.round(b.level * 100);
    const chargingTime = isFinite(b.chargingTime) ? b.chargingTime : null;
    const dischargingTime = isFinite(b.dischargingTime) ? b.dischargingTime : null;
    this._snapshot = {
      level,
      charging: b.charging,
      chargingTime,
      dischargingTime,
      chargingTimeLabel: formatDuration(chargingTime),
      dischargingTimeLabel: formatDuration(dischargingTime),
      status: getBatteryStatus(level),
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
