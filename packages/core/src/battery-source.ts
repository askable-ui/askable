import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableBatterySourceSnapshot {
  /** Battery charge level as a percentage (0-100), or null when unavailable. */
  level: number | null;
  /** Whether the device is currently charging. */
  charging: boolean;
  /** Estimated seconds until the battery is fully charged, or null. */
  chargingTime: number | null;
  /** Estimated seconds until the battery is discharged, or null. */
  dischargingTime: number | null;
  /** Human-readable charging time string (e.g. "~45 min remaining"). */
  chargingTimeLabel: string | null;
  /** Human-readable discharging time string (e.g. "~2h 10min remaining"). */
  dischargingTimeLabel: string | null;
  /** Battery level category based on level. */
  status: 'critical' | 'low' | 'medium' | 'high' | 'full' | 'unknown';
}

export interface AskableCreateBatterySourceOptions {
  /**
   * Returns the current battery snapshot. Called on each resolve.
   * Framework hooks manage Battery API subscriptions; this getter reads the result.
   */
  getSnapshot: () => AskableBatterySourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableBatterySourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "battery". */
  kind?: string;
}

export function getBatteryStatus(level: number | null): AskableBatterySourceSnapshot['status'] {
  if (level === null) return 'unknown';
  if (level >= 100) return 'full';
  if (level >= 60) return 'high';
  if (level >= 30) return 'medium';
  if (level >= 15) return 'low';
  return 'critical';
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !isFinite(seconds) || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `~${h}h ${m}min remaining`;
  return `~${m} min remaining`;
}

function defaultDescribe(snap: AskableBatterySourceSnapshot): string {
  if (snap.level === null) return 'Battery status unavailable.';

  const parts: string[] = [];

  if (snap.charging) {
    parts.push(`Battery charging at ${snap.level}%.`);
    if (snap.chargingTimeLabel) parts.push(snap.chargingTimeLabel);
  } else {
    parts.push(`Battery at ${snap.level}% (${snap.status}).`);
    if (snap.dischargingTimeLabel) parts.push(snap.dischargingTimeLabel);
  }

  return parts.join(' ');
}

/**
 * Creates a battery context source that exposes device battery level and
 * charging state to AI assistants — enabling them to warn users before
 * starting long tasks when battery is low.
 *
 * @example
 * ```ts
 * // AI: "Your battery is at 12% and you're not charging.
 * //      Save your work before starting this export — it may take a while."
 * ```
 */
export function createAskableBatterySource(
  options: AskableCreateBatterySourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'battery',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'Battery status unavailable.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'Battery status unavailable.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        level: snap?.level ?? null,
        charging: snap?.charging ?? false,
        status: snap?.status ?? 'unknown',
      };
    },
    data: () => options.getSnapshot(),
  });
}
