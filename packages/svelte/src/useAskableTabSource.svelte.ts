import { onMount, onDestroy } from 'svelte';
import { createAskableTabSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateTabSourceOptions,
  AskableTabSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableTabSourceSnapshot };

export interface UseAskableTabSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateTabSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "tab". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
}

export interface UseAskableTabSource extends UseAskableSource {
  readonly snapshot: AskableTabSourceSnapshot | null;
}

function getVisibility(): 'visible' | 'hidden' | 'prerender' {
  if (typeof document === 'undefined') return 'visible';
  return (document.visibilityState as 'visible' | 'hidden' | 'prerender') ?? 'visible';
}

/**
 * Svelte 5 runes-based composable that tracks browser tab visibility using the
 * Page Visibility API and exposes it to AI assistants so they understand when
 * users switch away.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableTabSource } from '@askable-ui/svelte/useAskableTabSource.svelte';
 *   const { snapshot } = useAskableTabSource();
 * </script>
 * ```
 */
export function useAskableTabSource(
  options: UseAskableTabSourceOptions = {},
): UseAskableTabSource {
  const {
    id = 'tab',
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const vis = getVisibility();
  let snapshot = $state<AskableTabSourceSnapshot | null>({
    visibility: vis,
    isVisible: vis === 'visible',
    isHidden: vis === 'hidden',
    visibleSince: vis === 'visible' ? new Date().toISOString() : null,
    hiddenSince: vis === 'hidden' ? new Date().toISOString() : null,
    hideCount: 0,
    hiddenSeconds: 0,
  });

  const tabSource = createAskableTabSource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...tabSource, ...ctxOptions, ctx, observe, enabled });

  let hideCount = 0;
  let hiddenSince: string | null = null;
  let visibleSince: string | null = snapshot?.visibleSince ?? null;

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
    snapshot = {
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

  onMount(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handler);
    }
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handler);
    }
  });

  return { ...result, get snapshot() { return snapshot; } };
}
