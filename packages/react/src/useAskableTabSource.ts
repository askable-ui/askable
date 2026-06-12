import { useEffect, useMemo, useRef, useState } from 'react';
import { createAskableTabSource } from '@askable-ui/core';
import type {
  AskableCreateTabSourceOptions,
  AskableTabSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableTabSourceSnapshot };

export interface UseAskableTabSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateTabSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "tab". */
  id?: string;
}

export interface UseAskableTabSourceResult extends UseAskableSourceResult {
  /** Current tab visibility snapshot. */
  snapshot: AskableTabSourceSnapshot | null;
}

function getVisibility(): 'visible' | 'hidden' | 'prerender' {
  if (typeof document === 'undefined') return 'visible';
  return (document.visibilityState as 'visible' | 'hidden' | 'prerender') ?? 'visible';
}

function buildInitialSnapshot(): AskableTabSourceSnapshot {
  const vis = getVisibility();
  return {
    visibility: vis,
    isVisible: vis === 'visible',
    isHidden: vis === 'hidden',
    visibleSince: vis === 'visible' ? new Date().toISOString() : null,
    hiddenSince: vis === 'hidden' ? new Date().toISOString() : null,
    hideCount: 0,
    hiddenSeconds: 0,
  };
}

/**
 * React hook that tracks browser tab visibility using the Page Visibility API
 * and exposes it to AI assistants so they understand when users switch away.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableTabSource();
 * // AI: "I noticed you switched away from this tab for 3 minutes.
 * //      The live data feed paused while you were away."
 * ```
 */
export function useAskableTabSource(
  options: UseAskableTabSourceOptions = {},
): UseAskableTabSourceResult {
  const { id = 'tab', describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = useState<AskableTabSourceSnapshot | null>(buildInitialSnapshot);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () => createAskableTabSource({ describe, kind, getSnapshot: () => snapshotRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });
  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let hideCount = snapshotRef.current?.hideCount ?? 0;
    let hiddenSince: string | null = snapshotRef.current?.hiddenSince ?? null;
    let visibleSince: string | null = snapshotRef.current?.visibleSince ?? null;

    const handler = () => {
      const vis = getVisibility();
      const now = new Date().toISOString();
      if (vis === 'hidden') {
        hideCount += 1;
        hiddenSince = now;
        visibleSince = null;
      } else {
        hiddenSince = null;
        visibleSince = now;
      }
      const hiddenSeconds = hiddenSince
        ? Math.floor((Date.now() - new Date(hiddenSince).getTime()) / 1000)
        : 0;
      setSnapshot({
        visibility: vis,
        isVisible: vis === 'visible',
        isHidden: vis === 'hidden',
        visibleSince,
        hiddenSince,
        hideCount,
        hiddenSeconds,
      });
      notifyRef.current();
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return { ...result, snapshot };
}
