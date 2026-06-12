import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export type AskableNetworkConnectionType =
  | 'bluetooth'
  | 'cellular'
  | 'ethernet'
  | 'none'
  | 'wifi'
  | 'wimax'
  | 'other'
  | 'unknown';

export type AskableNetworkEffectiveType = '2g' | '3g' | '4g' | 'slow-2g';

export interface AskableNetworkSourceSnapshot {
  /** Whether the browser believes the device is online. */
  isOnline: boolean;
  /** Whether the device appears to be offline. */
  isOffline: boolean;
  /** Connection type from the Network Information API, or "unknown". */
  connectionType: AskableNetworkConnectionType;
  /** Effective connection type (2g/3g/4g/slow-2g), or null if unavailable. */
  effectiveType: AskableNetworkEffectiveType | null;
  /** Estimated downstream bandwidth in Mbps, or null if unavailable. */
  downlink: number | null;
  /** Round-trip time in ms, or null if unavailable. */
  rtt: number | null;
  /** Whether the user has requested reduced data usage (Save-Data header). */
  saveData: boolean;
}

export interface AskableCreateNetworkSourceOptions {
  /** Custom describe function. */
  describe?: (snapshot: AskableNetworkSourceSnapshot) => string;
  /** Source category. Defaults to "network". */
  kind?: string;
}

function getConnection(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as unknown as { connection?: NetworkInformation }).connection
    ?? (navigator as unknown as { mozConnection?: NetworkInformation }).mozConnection
    ?? (navigator as unknown as { webkitConnection?: NetworkInformation }).webkitConnection
    ?? null;
}

interface NetworkInformation {
  type?: AskableNetworkConnectionType;
  effectiveType?: AskableNetworkEffectiveType;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

function buildSnapshot(): AskableNetworkSourceSnapshot {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const conn = getConnection();

  return {
    isOnline,
    isOffline: !isOnline,
    connectionType: conn?.type ?? 'unknown',
    effectiveType: conn?.effectiveType ?? null,
    downlink: conn?.downlink ?? null,
    rtt: conn?.rtt ?? null,
    saveData: conn?.saveData ?? false,
  };
}

function defaultDescribe(snapshot: AskableNetworkSourceSnapshot): string {
  const lines: string[] = [];

  lines.push(`Network: ${snapshot.isOnline ? 'Online' : 'Offline'}`);

  if (snapshot.isOnline) {
    if (snapshot.connectionType && snapshot.connectionType !== 'unknown') {
      lines.push(`Connection type: ${snapshot.connectionType}`);
    }
    if (snapshot.effectiveType) {
      lines.push(`Effective speed: ${snapshot.effectiveType.toUpperCase()}`);
    }
    if (snapshot.downlink != null) {
      lines.push(`Bandwidth: ${snapshot.downlink} Mbps`);
    }
    if (snapshot.rtt != null) {
      lines.push(`Latency: ${snapshot.rtt}ms RTT`);
    }
    if (snapshot.saveData) {
      lines.push('Save-Data: enabled (user prefers reduced data usage)');
    }
  }

  return lines.join('\n');
}

/**
 * Creates a network status context source that exposes the device's current
 * connectivity — online/offline state, connection type, bandwidth, and latency —
 * so AI assistants can explain loading issues, adapt their responses for slow
 * connections, or warn about offline mode.
 *
 * Uses the Network Information API where available (Chrome/Android).
 *
 * @example
 * ```ts
 * const source = createAskableNetworkSource();
 * ctx.registerSource('network', source);
 *
 * // Auto-notify on connectivity changes
 * window.addEventListener('online', () => handle.notifyChanged());
 * window.addEventListener('offline', () => handle.notifyChanged());
 * navigator.connection?.addEventListener('change', () => handle.notifyChanged());
 * ```
 */
export function createAskableNetworkSource(
  options: AskableCreateNetworkSourceOptions = {},
): AskableContextSource {
  const { describe, kind = 'network' } = options;

  return createAskableSource({
    kind,
    describe: describe
      ? () => describe(buildSnapshot())
      : () => defaultDescribe(buildSnapshot()),
    state: () => {
      const s = buildSnapshot();
      return {
        isOnline: s.isOnline,
        effectiveType: s.effectiveType,
      };
    },
    data: () => buildSnapshot(),
  });
}
