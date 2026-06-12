import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAskableIdleSource } from '@askable-ui/core';
import type {
  AskableCreateIdleSourceOptions,
  AskableIdleSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableIdleSourceSnapshot };

export interface UseAskableIdleSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateIdleSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "idle". */
  id?: string;
  /**
   * Milliseconds of inactivity before the user is considered idle.
   * @default 300000 (5 minutes)
   */
  idleAfterMs?: number;
  /**
   * DOM events that reset the idle timer.
   * @default ['mousemove','mousedown','keydown','touchstart','scroll','click']
   */
  activityEvents?: string[];
  /**
   * Automatically listen to activity events and update idle state.
   * @default true
   */
  autoTrack?: boolean;
}

export interface UseAskableIdleSourceResult extends UseAskableSourceResult {
  /** Current idle snapshot. */
  snapshot: AskableIdleSourceSnapshot | null;
  /** Manually mark the user as active (resets the idle timer). */
  markActive: () => void;
}

const DEFAULT_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

/**
 * React hook that detects user idleness and exposes the state to AI assistants
 * so they can understand session inactivity and trigger context-aware prompts.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableIdleSource({ idleAfterMs: 5 * 60 * 1000 });
 * // AI: "The user has been idle for 8 minutes. Their session may expire soon."
 * ```
 */
export function useAskableIdleSource(
  options: UseAskableIdleSourceOptions = {},
): UseAskableIdleSourceResult {
  const {
    id = 'idle',
    idleAfterMs = 5 * 60 * 1000,
    activityEvents = DEFAULT_EVENTS,
    autoTrack = true,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const lastActiveRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [snapshot, setSnapshot] = useState<AskableIdleSourceSnapshot | null>(() => ({
    isIdle: false,
    isActive: true,
    lastActiveAt: new Date().toISOString(),
    idleSeconds: 0,
    secondsSinceActive: 0,
  }));

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () =>
      createAskableIdleSource({
        describe,
        kind,
        getSnapshot: () => snapshotRef.current,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  const updateSnapshot = useCallback(() => {
    const now = Date.now();
    const msSince = now - lastActiveRef.current;
    const isIdle = msSince >= idleAfterMs;
    const secondsSinceActive = Math.floor(msSince / 1000);
    setSnapshot({
      isIdle,
      isActive: !isIdle,
      lastActiveAt: new Date(lastActiveRef.current).toISOString(),
      idleSeconds: isIdle ? secondsSinceActive : 0,
      secondsSinceActive,
    });
    notifyRef.current();
  }, [idleAfterMs]);

  const markActive = useCallback(() => {
    lastActiveRef.current = Date.now();
    updateSnapshot();
  }, [updateSnapshot]);

  useEffect(() => {
    if (!autoTrack) return;

    const handler = () => markActive();
    activityEvents.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));

    timerRef.current = setInterval(updateSnapshot, 5000);

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, handler));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoTrack, activityEvents, markActive, updateSnapshot]);

  return { ...result, snapshot, markActive };
}
