import { ref, onMounted, onUnmounted, type MaybeRef } from 'vue';
import { createAskableTimeSource, buildTimeSnapshot } from '@askable-ui/core';
import type {
  AskableBusinessHoursConfig,
  AskableCreateTimeSourceOptions,
  AskableTimeSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableBusinessHoursConfig, AskableTimeSourceSnapshot };

export interface UseAskableTimeSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateTimeSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "time". */
  id?: string;
  /** How often to update the snapshot in milliseconds. @default 60000 */
  intervalMs?: MaybeRef<number>;
  /** Custom business hours configuration. */
  businessHours?: AskableBusinessHoursConfig;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableTimeSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableTimeSourceSnapshot | null>>;
}

/**
 * Vue composable that tracks the current local time, timezone, and business
 * hours status and exposes it to AI assistants.
 *
 * @example
 * ```ts
 * const { snapshot } = useAskableTimeSource({ intervalMs: 30000 });
 * ```
 */
export function useAskableTimeSource(
  options: UseAskableTimeSourceOptions = {},
): UseAskableTimeSourceResult {
  const { id = 'time', intervalMs = 60000, businessHours = {}, describe, kind, enabled, ctx, name, events } = options;

  const sessionStart = Date.now();
  const snapshot = ref<AskableTimeSourceSnapshot | null>(buildTimeSnapshot(businessHours, sessionStart));
  const source = createAskableTimeSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let timer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    timer = setInterval(() => {
      snapshot.value = buildTimeSnapshot(businessHours, sessionStart);
      result.notifyChanged();
    }, typeof intervalMs === 'number' ? intervalMs : 60000);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { ...result, snapshot };
}
