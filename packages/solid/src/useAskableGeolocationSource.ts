import { createEffect, createSignal, onCleanup } from 'solid-js';
import { createAskableGeolocationSource } from '@askable-ui/core';
import type {
  AskableCreateGeolocationSourceOptions,
  AskableGeolocationCoords,
  AskableGeolocationSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableGeolocationCoords, AskableGeolocationSourceSnapshot };

export interface UseAskableGeolocationSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateGeolocationSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "geolocation". */
  id?: string;
  /** Automatically request the user's location on mount. @default false */
  autoRequest?: boolean;
  /** Watch position for continuous updates. @default false */
  watch?: boolean;
  /** Geolocation API options. */
  positionOptions?: PositionOptions;
}

export interface UseAskableGeolocationSourceResult extends UseAskableSourceResult {
  snapshot: () => AskableGeolocationSourceSnapshot | null;
  requestPosition: () => void;
}

function coordsFromPosition(pos: GeolocationPosition): AskableGeolocationCoords {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    altitude: pos.coords.altitude,
    accuracy: pos.coords.accuracy,
    altitudeAccuracy: pos.coords.altitudeAccuracy,
    heading: pos.coords.heading,
    speed: pos.coords.speed,
  };
}

/**
 * SolidJS primitive that tracks the user's geolocation using the Geolocation API
 * and exposes it to AI assistants for location-aware assistance.
 *
 * @example
 * ```tsx
 * const { snapshot, requestPosition } = useAskableGeolocationSource({ autoRequest: true });
 * ```
 */
export function useAskableGeolocationSource(
  options: UseAskableGeolocationSourceOptions = {},
): UseAskableGeolocationSourceResult {
  const { id = 'geolocation', autoRequest = false, watch = false, positionOptions, describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = createSignal<AskableGeolocationSourceSnapshot | null>({
    coords: null, timestamp: null, hasPosition: false, isLoading: false, error: null, permissionState: 'unknown',
  });

  const source = createAskableGeolocationSource({ describe, kind, getSnapshot: snapshot });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function onSuccess(pos: GeolocationPosition): void {
    setSnapshot({ coords: coordsFromPosition(pos), timestamp: new Date(pos.timestamp).toISOString(), hasPosition: true, isLoading: false, error: null, permissionState: 'granted' });
    result.notifyChanged();
  }

  function onError(err: GeolocationPositionError): void {
    setSnapshot((prev) => ({ ...prev!, isLoading: false, error: err.message, permissionState: err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown' }));
    result.notifyChanged();
  }

  function requestPosition(): void {
    if (!navigator.geolocation) return;
    setSnapshot((prev) => ({ ...prev!, isLoading: true }));
    navigator.geolocation.getCurrentPosition(onSuccess, onError, positionOptions);
    result.notifyChanged();
  }

  createEffect(() => {
    if (!navigator.geolocation) return;
    if (watch) {
      setSnapshot((prev) => ({ ...prev!, isLoading: true }));
      const watchId = navigator.geolocation.watchPosition(onSuccess, onError, positionOptions);
      onCleanup(() => navigator.geolocation.clearWatch(watchId));
    } else if (autoRequest) {
      requestPosition();
    }
  });

  return { ...result, snapshot, requestPosition };
}
