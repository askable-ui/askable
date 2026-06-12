import { ref, onMounted, onUnmounted, type MaybeRef } from 'vue';
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
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableBatterySourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableBatterySourceSnapshot | null>>;
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
 * Vue composable that subscribes to the Battery Status API and exposes device
 * battery level and charging state to AI assistants.
 *
 * @example
 * ```ts
 * const { snapshot } = useAskableBatterySource();
 * ```
 */
export function useAskableBatterySource(
  options: UseAskableBatterySourceOptions = {},
): UseAskableBatterySourceResult {
  const { id = 'battery', describe, kind, enabled, ctx, name, events } = options;

  const snapshot = ref<AskableBatterySourceSnapshot | null>(null);
  const source = createAskableBatterySource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let battery: BatteryManager | null = null;

  function update(): void {
    if (!battery) return;
    const level = Math.round(battery.level * 100);
    const chargingTime = isFinite(battery.chargingTime) ? battery.chargingTime : null;
    const dischargingTime = isFinite(battery.dischargingTime) ? battery.dischargingTime : null;
    snapshot.value = {
      level,
      charging: battery.charging,
      chargingTime,
      dischargingTime,
      chargingTimeLabel: formatDuration(chargingTime),
      dischargingTimeLabel: formatDuration(dischargingTime),
      status: getBatteryStatus(level),
    };
    result.notifyChanged();
  }

  onMounted(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (!nav.getBattery) return;
    nav.getBattery().then((b) => {
      battery = b;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
      b.addEventListener('chargingtimechange', update);
      b.addEventListener('dischargingtimechange', update);
    }).catch(() => undefined);
  });

  onUnmounted(() => {
    if (battery) {
      battery.removeEventListener('levelchange', update);
      battery.removeEventListener('chargingchange', update);
      battery.removeEventListener('chargingtimechange', update);
      battery.removeEventListener('dischargingtimechange', update);
    }
  });

  return { ...result, snapshot };
}
