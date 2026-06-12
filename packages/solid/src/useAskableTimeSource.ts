import { createEffect, createSignal, onCleanup } from 'solid-js';
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
  intervalMs?: number;
  /** Custom business hours configuration. */
  businessHours?: AskableBusinessHoursConfig;
}

export interface UseAskableTimeSourceResult extends UseAskableSourceResult {
  snapshot: () => AskableTimeSourceSnapshot | null;
}

/**
 * SolidJS primitive that tracks the current local time, timezone, and business
 * hours status and exposes it to AI assistants.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableTimeSource();
 * ```
 */
export function useAskableTimeSource(
  options: UseAskableTimeSourceOptions = {},
): UseAskableTimeSourceResult {
  const { id = 'time', intervalMs = 60000, businessHours = {}, describe, kind, enabled, ctx, name, events } = options;

  const sessionStart = Date.now();
  const [snapshot, setSnapshot] = createSignal<AskableTimeSourceSnapshot | null>(buildTimeSnapshot(businessHours, sessionStart));
  const source = createAskableTimeSource({ describe, kind, getSnapshot: snapshot });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  createEffect(() => {
    const timer = setInterval(() => {
      setSnapshot(buildTimeSnapshot(businessHours, sessionStart));
      result.notifyChanged();
    }, intervalMs);
    onCleanup(() => clearInterval(timer));
  });

  return { ...result, snapshot };
}
