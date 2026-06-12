import { onMount, onDestroy } from 'svelte';
import { createAskableBatterySource, getBatteryStatus, formatDuration } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateBatterySourceOptions,
  AskableBatterySourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableBatterySourceSnapshot };

export interface UseAskableBatterySourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateBatterySourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "battery". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
}

export interface UseAskableBatterySource extends UseAskableSource {
  readonly snapshot: AskableBatterySourceSnapshot | null;
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
 * Svelte 5 runes-based composable that subscribes to the Battery Status API
 * and exposes device battery level and charging state to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableBatterySource } from '@askable-ui/svelte/useAskableBatterySource.svelte';
 *   const { snapshot } = useAskableBatterySource();
 * </script>
 * ```
 */
export function useAskableBatterySource(
  options: UseAskableBatterySourceOptions = {},
): UseAskableBatterySource {
  const {
    id = 'battery',
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let snapshot = $state<AskableBatterySourceSnapshot | null>(null);
  let battery: BatteryManager | null = null;

  const batterySource = createAskableBatterySource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...batterySource, ...ctxOptions, ctx, observe, enabled });

  function update(): void {
    if (!battery) return;
    const level = Math.round(battery.level * 100);
    const chargingTime = isFinite(battery.chargingTime) ? battery.chargingTime : null;
    const dischargingTime = isFinite(battery.dischargingTime) ? battery.dischargingTime : null;
    snapshot = {
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

  onMount(() => {
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

  onDestroy(() => {
    if (battery) {
      battery.removeEventListener('levelchange', update);
      battery.removeEventListener('chargingchange', update);
      battery.removeEventListener('chargingtimechange', update);
      battery.removeEventListener('dischargingtimechange', update);
    }
  });

  return { ...result, get snapshot() { return snapshot; } };
}
