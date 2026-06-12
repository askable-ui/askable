import { useEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * How often to update the snapshot in milliseconds.
   * @default 60000 (1 minute)
   */
  intervalMs?: number;
  /** Custom business hours configuration. */
  businessHours?: AskableBusinessHoursConfig;
}

export interface UseAskableTimeSourceResult extends UseAskableSourceResult {
  /** Current time snapshot. */
  snapshot: AskableTimeSourceSnapshot | null;
}

/**
 * React hook that tracks the current local time, timezone, and business hours
 * status and exposes it to AI assistants so they can give time-aware assistance.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableTimeSource();
 * // AI: "It's 5:45pm on a Friday — outside business hours for most teams."
 * ```
 */
export function useAskableTimeSource(
  options: UseAskableTimeSourceOptions = {},
): UseAskableTimeSourceResult {
  const { id = 'time', intervalMs = 60000, businessHours = {}, describe, kind, enabled, ctx, name, events } = options;

  const sessionStartRef = useRef(Date.now());

  const [snapshot, setSnapshot] = useState<AskableTimeSourceSnapshot | null>(() =>
    buildTimeSnapshot(businessHours, sessionStartRef.current),
  );

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () => createAskableTimeSource({ describe, kind, getSnapshot: () => snapshotRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });
  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  useEffect(() => {
    const tick = () => {
      setSnapshot(buildTimeSnapshot(businessHours, sessionStartRef.current));
      notifyRef.current();
    };

    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, businessHours]);

  return { ...result, snapshot };
}
