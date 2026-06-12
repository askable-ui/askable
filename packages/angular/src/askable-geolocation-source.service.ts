import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableGeolocationSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateGeolocationSourceOptions,
  AskableGeolocationCoords,
  AskableGeolocationSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableGeolocationCoords, AskableGeolocationSourceSnapshot };

export interface AskableGeolocationSourceServiceOptions
  extends Omit<AskableCreateGeolocationSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "geolocation". */
  id?: string;
  /**
   * Automatically request the user's location on init.
   * @default false
   */
  autoRequest?: boolean;
  /**
   * Watch for position changes (continuous tracking).
   * @default false
   */
  watch?: boolean;
  /** Geolocation API options. */
  positionOptions?: PositionOptions;
}

/**
 * Angular service that tracks the user's geolocation using the Geolocation API
 * and exposes it to AI assistants for location-aware assistance.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableGeolocationSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly geoSource = inject(AskableGeolocationSourceService);
 *   ngOnInit() { this.geoSource.init({ autoRequest: true }); }
 * }
 * ```
 */
@Injectable()
export class AskableGeolocationSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'geolocation';
  private _snapshot: AskableGeolocationSourceSnapshot | null = null;
  private _watchId: number | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskableGeolocationSourceSnapshot | null { return this._snapshot; }

  init(options: AskableGeolocationSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'geolocation', autoRequest = false, watch = false, positionOptions, describe, kind } = options;
    this._sourceId = id;
    this._snapshot = { coords: null, timestamp: null, hasPosition: false, isLoading: false, error: null, permissionState: 'unknown' };

    const source = createAskableGeolocationSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    if (watch) {
      this._snapshot = { ...this._snapshot!, isLoading: true };
      this._watchId = navigator.geolocation.watchPosition(
        (pos) => this._onSuccess(pos),
        (err) => this._onError(err),
        positionOptions,
      );
    } else if (autoRequest) {
      this.requestPosition(positionOptions);
    }
  }

  private _onSuccess(pos: GeolocationPosition): void {
    this._snapshot = {
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        altitude: pos.coords.altitude,
        accuracy: pos.coords.accuracy,
        altitudeAccuracy: pos.coords.altitudeAccuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
      },
      timestamp: new Date(pos.timestamp).toISOString(),
      hasPosition: true,
      isLoading: false,
      error: null,
      permissionState: 'granted',
    };
    this.notifyChanged();
  }

  private _onError(err: GeolocationPositionError): void {
    this._snapshot = {
      ...this._snapshot!,
      isLoading: false,
      error: err.message,
      permissionState: err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown',
    };
    this.notifyChanged();
  }

  requestPosition(options?: PositionOptions): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    this._snapshot = { ...this._snapshot!, isLoading: true };
    navigator.geolocation.getCurrentPosition(
      (pos) => this._onSuccess(pos),
      (err) => this._onError(err),
      options,
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
    if (this._watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
