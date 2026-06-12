import { ref, onMounted, onUnmounted, type MaybeRef } from 'vue';
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
  autoRequest?: MaybeRef<boolean>;
  /** Watch position for continuous updates. @default false */
  watch?: MaybeRef<boolean>;
  /** Geolocation API options. */
  positionOptions?: PositionOptions;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableGeolocationSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableGeolocationSourceSnapshot | null>>;
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
 * Vue composable that tracks the user's geolocation using the Geolocation API
 * and exposes it to AI assistants for location-aware assistance.
 *
 * @example
 * ```ts
 * const { snapshot, requestPosition } = useAskableGeolocationSource({ autoRequest: true });
 * ```
 */
export function useAskableGeolocationSource(
  options: UseAskableGeolocationSourceOptions = {},
): UseAskableGeolocationSourceResult {
  const { id = 'geolocation', autoRequest = false, watch = false, positionOptions, describe, kind, enabled, ctx, name, events } = options;

  const snapshot = ref<AskableGeolocationSourceSnapshot | null>({
    coords: null, timestamp: null, hasPosition: false, isLoading: false, error: null, permissionState: 'unknown',
  });

  const source = createAskableGeolocationSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let watchId: number | null = null;

  function onSuccess(pos: GeolocationPosition): void {
    snapshot.value = { coords: coordsFromPosition(pos), timestamp: new Date(pos.timestamp).toISOString(), hasPosition: true, isLoading: false, error: null, permissionState: 'granted' };
    result.notifyChanged();
  }

  function onError(err: GeolocationPositionError): void {
    snapshot.value = { ...snapshot.value!, isLoading: false, error: err.message, permissionState: err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown' };
    result.notifyChanged();
  }

  function requestPosition(): void {
    if (!navigator.geolocation) return;
    snapshot.value = { ...snapshot.value!, isLoading: true };
    navigator.geolocation.getCurrentPosition(onSuccess, onError, positionOptions);
    result.notifyChanged();
  }

  onMounted(() => {
    if (!navigator.geolocation) return;
    if (watch) {
      snapshot.value = { ...snapshot.value!, isLoading: true };
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, positionOptions);
    } else if (autoRequest) {
      requestPosition();
    }
  });

  onUnmounted(() => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
  });

  return { ...result, snapshot, requestPosition };
}
