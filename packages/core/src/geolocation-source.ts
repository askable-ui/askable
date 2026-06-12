import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableGeolocationCoords {
  /** Latitude in decimal degrees. */
  latitude: number;
  /** Longitude in decimal degrees. */
  longitude: number;
  /** Altitude in meters above mean sea level, or null if unavailable. */
  altitude: number | null;
  /** Accuracy radius in meters. */
  accuracy: number | null;
  /** Altitude accuracy in meters, or null if unavailable. */
  altitudeAccuracy: number | null;
  /** Device heading in degrees (0=North, 90=East), or null if unavailable. */
  heading: number | null;
  /** Device speed in meters/second, or null if unavailable. */
  speed: number | null;
}

export interface AskableGeolocationSourceSnapshot {
  /** Current coordinates, or null if not yet acquired or unavailable. */
  coords: AskableGeolocationCoords | null;
  /** ISO timestamp when the position was last acquired. */
  timestamp: string | null;
  /** Whether a position has been acquired. */
  hasPosition: boolean;
  /** Whether position acquisition is in progress. */
  isLoading: boolean;
  /** Error message if position acquisition failed. */
  error: string | null;
  /** Permission state: 'granted', 'denied', 'prompt', or 'unknown'. */
  permissionState: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export interface AskableCreateGeolocationSourceOptions {
  /**
   * Returns the current geolocation snapshot. Called on each resolve.
   * Framework hooks manage Geolocation API subscriptions; this getter reads the result.
   */
  getSnapshot: () => AskableGeolocationSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableGeolocationSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "geolocation". */
  kind?: string;
}

function formatCoords(coords: AskableGeolocationCoords): string {
  const lat = coords.latitude.toFixed(4);
  const lng = coords.longitude.toFixed(4);
  const acc = coords.accuracy != null ? ` (±${Math.round(coords.accuracy)}m)` : '';
  return `${lat}, ${lng}${acc}`;
}

function defaultDescribe(snap: AskableGeolocationSourceSnapshot): string {
  if (snap.error) return `Geolocation error: ${snap.error}`;
  if (snap.permissionState === 'denied') return 'Geolocation permission denied.';
  if (snap.isLoading) return 'Acquiring location...';
  if (!snap.coords) return 'Location not available.';
  return `Location: ${formatCoords(snap.coords)}`;
}

/**
 * Creates a geolocation context source that exposes the user's current position
 * to AI assistants — enabling location-aware features like nearest store lookup,
 * delivery estimates, and timezone-aware scheduling.
 *
 * @example
 * ```ts
 * // AI: "Based on your location (40.7128, -74.0060), the nearest pickup point
 * //      is 0.3 miles away. Expected delivery: today by 5pm."
 * ```
 */
export function createAskableGeolocationSource(
  options: AskableCreateGeolocationSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'geolocation',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'Location not available.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'Location not available.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        hasPosition: snap?.hasPosition ?? false,
        isLoading: snap?.isLoading ?? false,
        permissionState: snap?.permissionState ?? 'unknown',
        hasError: snap?.error != null,
      };
    },
    data: () => options.getSnapshot(),
  });
}
