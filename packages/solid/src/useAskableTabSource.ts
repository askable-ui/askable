import { createEffect, createSignal, onCleanup } from 'solid-js';
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
  snapshot: () => AskableTabSourceSnapshot | null;
}

function getVisibility(): 'visible' | 'hidden' | 'prerender' {
  if (typeof document === 'undefined') return 'visible';
  return (document.visibilityState as 'visible' | 'hidden' | 'prerender') ?? 'visible';
}

/**
 * SolidJS primitive that tracks browser tab visibility using the Page Visibility API
 * and exposes it to AI assistants so they understand when users switch away.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableTabSource();
 * ```
 */
export function useAskableTabSource(
  options: UseAskableTabSourceOptions = {},
): UseAskableTabSourceResult {
  const { id = 'tab', describe, kind, enabled, ctx, name, events } = options;

  const vis = getVisibility();
  const [snapshot, setSnapshot] = createSignal<AskableTabSourceSnapshot | null>({
    visibility: vis,
    isVisible: vis === 'visible',
    isHidden: vis === 'hidden',
    visibleSince: vis === 'visible' ? new Date().toISOString() : null,
    hiddenSince: vis === 'hidden' ? new Date().toISOString() : null,
    hideCount: 0,
    hiddenSeconds: 0,
  });

  const source = createAskableTabSource({ describe, kind, getSnapshot: snapshot });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let hideCount = 0;
  let hiddenSince: string | null = null;
  let visibleSince: string | null = snapshot()?.visibleSince ?? null;

  createEffect(() => {
    if (typeof document === 'undefined') return;

    const handler = () => {
      const v = getVisibility();
      const now = new Date().toISOString();
      if (v === 'hidden') {
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
        visibility: v,
        isVisible: v === 'visible',
        isHidden: v === 'hidden',
        visibleSince,
        hiddenSince,
        hideCount,
        hiddenSeconds,
      });
      result.notifyChanged();
    };

    document.addEventListener('visibilitychange', handler);
    onCleanup(() => document.removeEventListener('visibilitychange', handler));
  });

  return { ...result, snapshot };
}
