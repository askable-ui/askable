import { useEffect, useMemo, useRef, useState } from 'react';
import { createAskableBatterySource, getBatteryStatus, formatDuration } from '@askable-ui/core';
import type {
  AskableCreateBatterySourceOptions,
  AskableBatterySourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableBatterySourceSnapshot };

export interface UseAskableBatterySourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateBatterySourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "battery". */
  id?: string;
}

export interface UseAskableBatterySourceResult extends UseAskableSourceResult {
  /** Current battery snapshot, or null if Battery API is unavailable. */
  snapshot: AskableBatterySourceSnapshot | null;
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
 * React hook that subscribes to the Battery Status API and exposes device
 * battery level and charging state to AI assistants so they can warn users
 * before starting long tasks when battery is low.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableBatterySource();
 * // AI: "Your battery is at 12%. Save your work before starting this export."
 * ```
 */
export function useAskableBatterySource(
  options: UseAskableBatterySourceOptions = {},
): UseAskableBatterySourceResult {
  const { id = 'battery', describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = useState<AskableBatterySourceSnapshot | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () => createAskableBatterySource({ describe, kind, getSnapshot: () => snapshotRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });
  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (!nav.getBattery) return;

    let battery: BatteryManager | null = null;

    function update(): void {
      if (!battery) return;
      const level = Math.round(battery.level * 100);
      const chargingTime = isFinite(battery.chargingTime) ? battery.chargingTime : null;
      const dischargingTime = isFinite(battery.dischargingTime) ? battery.dischargingTime : null;
      setSnapshot({
        level,
        charging: battery.charging,
        chargingTime,
        dischargingTime,
        chargingTimeLabel: formatDuration(chargingTime),
        dischargingTimeLabel: formatDuration(dischargingTime),
        status: getBatteryStatus(level),
      });
      notifyRef.current();
    }

    nav.getBattery().then((b) => {
      battery = b;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
      b.addEventListener('chargingtimechange', update);
      b.addEventListener('dischargingtimechange', update);
    }).catch(() => undefined);

    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', update);
        battery.removeEventListener('chargingchange', update);
        battery.removeEventListener('chargingtimechange', update);
        battery.removeEventListener('dischargingtimechange', update);
      }
    };
  }, []);

  return { ...result, snapshot };
}
