import { useEffect, useMemo } from 'react';
import { createAskableWindowSource } from '@askable-ui/core';
import type {
  AskableCreateWindowSourceOptions,
  AskableDeviceCategory,
  AskableOrientation,
  AskableWindowSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableDeviceCategory, AskableOrientation, AskableWindowSourceSnapshot };

export interface UseAskableWindowSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateWindowSourceOptions {
  /** Source registration id. Defaults to "window". */
  id?: string;
  /**
   * Automatically register a resize listener and notify on window resize.
   * @default true
   */
  autoTrack?: boolean;
  /**
   * Throttle resize events (milliseconds).
   * @default 150
   */
  throttleMs?: number;
}

export type UseAskableWindowSourceResult = UseAskableSourceResult;

/**
 * React hook that exposes viewport dimensions, device category (mobile/tablet/desktop),
 * active breakpoint (xs/sm/md/lg/xl/2xl), orientation, and pixel density to AI assistants.
 *
 * Perfect for responsive design questions: "Why is my sidebar hidden?" — the AI
 * knows the user is on a 375px mobile viewport in portrait orientation.
 *
 * @example
 * ```tsx
 * useAskableWindowSource();
 *
 * // AI now knows: "Viewport: 375×812px (mobile, xs breakpoint), portrait"
 * ```
 */
export function useAskableWindowSource(
  options: UseAskableWindowSourceOptions = {},
): UseAskableWindowSourceResult {
  const {
    id = 'window',
    autoTrack = true,
    throttleMs = 150,
    breakpoints,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = useMemo(
    () => createAskableWindowSource({ breakpoints, describe, kind }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  useEffect(() => {
    if (!autoTrack) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const notify = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        result.notifyChanged();
      }, throttleMs);
    };

    window.addEventListener('resize', notify, { passive: true });
    window.addEventListener('orientationchange', notify);
    document.addEventListener('fullscreenchange', notify);

    return () => {
      window.removeEventListener('resize', notify);
      window.removeEventListener('orientationchange', notify);
      document.removeEventListener('fullscreenchange', notify);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [autoTrack, throttleMs, result]);

  return result;
}
