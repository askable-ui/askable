import { ref, onMounted, onUnmounted, type MaybeRef } from 'vue';
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
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableTabSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableTabSourceSnapshot | null>>;
}

function getVisibility(): 'visible' | 'hidden' | 'prerender' {
  if (typeof document === 'undefined') return 'visible';
  return (document.visibilityState as 'visible' | 'hidden' | 'prerender') ?? 'visible';
}

/**
 * Vue composable that tracks browser tab visibility using the Page Visibility API
 * and exposes it to AI assistants so they understand when users switch away.
 *
 * @example
 * ```ts
 * const { snapshot } = useAskableTabSource();
 * ```
 */
export function useAskableTabSource(
  options: UseAskableTabSourceOptions = {},
): UseAskableTabSourceResult {
  const { id = 'tab', describe, kind, enabled, ctx, name, events } = options;

  const vis = getVisibility();
  const snapshot = ref<AskableTabSourceSnapshot | null>({
    visibility: vis,
    isVisible: vis === 'visible',
    isHidden: vis === 'hidden',
    visibleSince: vis === 'visible' ? new Date().toISOString() : null,
    hiddenSince: vis === 'hidden' ? new Date().toISOString() : null,
    hideCount: 0,
    hiddenSeconds: 0,
  });

  const source = createAskableTabSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let hideCount = 0;
  let hiddenSince: string | null = null;
  let visibleSince: string | null = snapshot.value?.visibleSince ?? null;

  function handler(): void {
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
    snapshot.value = {
      visibility: v,
      isVisible: v === 'visible',
      isHidden: v === 'hidden',
      visibleSince,
      hiddenSince,
      hideCount,
      hiddenSeconds,
    };
    result.notifyChanged();
  }

  onMounted(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handler);
    }
  });

  onUnmounted(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handler);
    }
  });

  return { ...result, snapshot };
}
