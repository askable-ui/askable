import { onMount, onDestroy } from 'svelte';
import { createAskableGeolocationSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateGeolocationSourceOptions,
  AskableGeolocationCoords,
  AskableGeolocationSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableGeolocationCoords, AskableGeolocationSourceSnapshot };

export interface UseAskableGeolocationSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateGeolocationSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "geolocation". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Automatically request the user's location on mount. @default false */
  autoRequest?: boolean;
  /** Watch position for continuous updates. @default false */
  watch?: boolean;
  /** Geolocation API options. */
  positionOptions?: PositionOptions;
}

export interface UseAskableGeolocationSource extends UseAskableSource {
  readonly snapshot: AskableGeolocationSourceSnapshot | null;
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
 * Svelte 5 runes-based composable that tracks the user's geolocation and
 * exposes it to AI assistants for location-aware assistance.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableGeolocationSource } from '@askable-ui/svelte/useAskableGeolocationSource.svelte';
 *   const { snapshot, requestPosition } = useAskableGeolocationSource({ autoRequest: true });
 * </script>
 * ```
 */
export function useAskableGeolocationSource(
  options: UseAskableGeolocationSourceOptions = {},
): UseAskableGeolocationSource {
  const {
    id = 'geolocation',
    autoRequest = false,
    watch = false,
    positionOptions,
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let snapshot = $state<AskableGeolocationSourceSnapshot | null>({
    coords: null, timestamp: null, hasPosition: false, isLoading: false, error: null, permissionState: 'unknown',
  });

  let watchId: number | null = null;

  const geoSource = createAskableGeolocationSource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...geoSource, ...ctxOptions, ctx, observe, enabled });

  function onSuccess(pos: GeolocationPosition): void {
    snapshot = { coords: coordsFromPosition(pos), timestamp: new Date(pos.timestamp).toISOString(), hasPosition: true, isLoading: false, error: null, permissionState: 'granted' };
    result.notifyChanged();
  }

  function onError(err: GeolocationPositionError): void {
    snapshot = { ...snapshot!, isLoading: false, error: err.message, permissionState: err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown' };
    result.notifyChanged();
  }

  function requestPosition(): void {
    if (!navigator.geolocation) return;
    snapshot = { ...snapshot!, isLoading: true };
    navigator.geolocation.getCurrentPosition(onSuccess, onError, positionOptions);
    result.notifyChanged();
  }

  onMount(() => {
    if (!navigator.geolocation) return;
    if (watch) {
      snapshot = { ...snapshot!, isLoading: true };
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, positionOptions);
    } else if (autoRequest) {
      requestPosition();
    }
  });

  onDestroy(() => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
  });

  return { ...result, requestPosition, get snapshot() { return snapshot; } };
}
