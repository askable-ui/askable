import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * Automatically request the user's location on mount.
   * @default false
   */
  autoRequest?: boolean;
  /**
   * Watch position for updates (continuous tracking).
   * @default false
   */
  watch?: boolean;
  /** Geolocation API options. */
  positionOptions?: PositionOptions;
}

export interface UseAskableGeolocationSourceResult extends UseAskableSourceResult {
  /** Current geolocation snapshot. */
  snapshot: AskableGeolocationSourceSnapshot | null;
  /** Manually request the current position. */
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
 * React hook that tracks the user's geolocation using the Geolocation API
 * and exposes it to AI assistants for location-aware assistance.
 *
 * @example
 * ```tsx
 * const { snapshot, requestPosition } = useAskableGeolocationSource({ autoRequest: true });
 * // AI: "Based on your location, the nearest pharmacy is 0.4 miles away."
 * ```
 */
export function useAskableGeolocationSource(
  options: UseAskableGeolocationSourceOptions = {},
): UseAskableGeolocationSourceResult {
  const { id = 'geolocation', autoRequest = false, watch = false, positionOptions, describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = useState<AskableGeolocationSourceSnapshot | null>(() => ({
    coords: null,
    timestamp: null,
    hasPosition: false,
    isLoading: false,
    error: null,
    permissionState: 'unknown',
  }));

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () => createAskableGeolocationSource({ describe, kind, getSnapshot: () => snapshotRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });
  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    setSnapshot({
      coords: coordsFromPosition(pos),
      timestamp: new Date(pos.timestamp).toISOString(),
      hasPosition: true,
      isLoading: false,
      error: null,
      permissionState: 'granted',
    });
    notifyRef.current();
  }, []);

  const onError = useCallback((err: GeolocationPositionError) => {
    setSnapshot((prev) => ({
      ...(prev ?? { coords: null, timestamp: null, hasPosition: false }),
      isLoading: false,
      error: err.message,
      permissionState: err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown',
    }));
    notifyRef.current();
  }, []);

  const requestPosition = useCallback(() => {
    if (!navigator.geolocation) return;
    setSnapshot((prev) => ({ ...(prev ?? { coords: null, timestamp: null, hasPosition: false, error: null, permissionState: 'unknown' as const }), isLoading: true }));
    navigator.geolocation.getCurrentPosition(onSuccess, onError, positionOptions);
    notifyRef.current();
  }, [onSuccess, onError, positionOptions]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    if (watch) {
      setSnapshot((prev) => ({ ...(prev ?? { coords: null, timestamp: null, hasPosition: false, error: null, permissionState: 'unknown' as const }), isLoading: true }));
      const watchId = navigator.geolocation.watchPosition(onSuccess, onError, positionOptions);
      return () => navigator.geolocation.clearWatch(watchId);
    } else if (autoRequest) {
      requestPosition();
    }
  }, [autoRequest, watch, onSuccess, onError, positionOptions, requestPosition]);

  return { ...result, snapshot, requestPosition };
}
