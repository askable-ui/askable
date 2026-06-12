import { createEffect, createSignal, onCleanup } from 'solid-js';
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
  snapshot: () => AskableBatterySourceSnapshot | null;
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
 * SolidJS primitive that subscribes to the Battery Status API and exposes
 * device battery level and charging state to AI assistants.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableBatterySource();
 * ```
 */
export function useAskableBatterySource(
  options: UseAskableBatterySourceOptions = {},
): UseAskableBatterySourceResult {
  const { id = 'battery', describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = createSignal<AskableBatterySourceSnapshot | null>(null);
  const source = createAskableBatterySource({ describe, kind, getSnapshot: snapshot });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  createEffect(() => {
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
      result.notifyChanged();
    }

    nav.getBattery().then((b) => {
      battery = b;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
      b.addEventListener('chargingtimechange', update);
      b.addEventListener('dischargingtimechange', update);
      onCleanup(() => {
        b.removeEventListener('levelchange', update);
        b.removeEventListener('chargingchange', update);
        b.removeEventListener('chargingtimechange', update);
        b.removeEventListener('dischargingtimechange', update);
      });
    }).catch(() => undefined);
  });

  return { ...result, snapshot };
}
