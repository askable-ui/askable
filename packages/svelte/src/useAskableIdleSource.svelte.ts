import { onMount, onDestroy } from 'svelte';
import { createAskableIdleSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateIdleSourceOptions,
  AskableIdleSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableIdleSourceSnapshot };

export interface UseAskableIdleSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateIdleSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "idle". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Milliseconds of inactivity before idle. @default 300000 (5 min) */
  idleAfterMs?: number;
  /** DOM events that reset the idle timer. */
  activityEvents?: string[];
  /** Automatically listen to activity events. @default true */
  autoTrack?: boolean;
}

export interface UseAskableIdleSource extends UseAskableSource {
  markActive: () => void;
  readonly snapshot: AskableIdleSourceSnapshot | null;
}

const DEFAULT_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

/**
 * Svelte 5 runes-based composable that detects user idleness and exposes the
 * state to AI assistants so they can understand session inactivity.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableIdleSource } from '@askable-ui/svelte/useAskableIdleSource.svelte';
 *   const { snapshot } = useAskableIdleSource({ idleAfterMs: 5 * 60 * 1000 });
 * </script>
 * ```
 */
export function useAskableIdleSource(
  options: UseAskableIdleSourceOptions = {},
): UseAskableIdleSource {
  const {
    id = 'idle',
    idleAfterMs = 5 * 60 * 1000,
    activityEvents = DEFAULT_EVENTS,
    autoTrack = true,
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let lastActive = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;

  let snapshot = $state<AskableIdleSourceSnapshot | null>({
    isIdle: false,
    isActive: true,
    lastActiveAt: new Date().toISOString(),
    idleSeconds: 0,
    secondsSinceActive: 0,
  });

  const idleSource = createAskableIdleSource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...idleSource, ...ctxOptions, ctx, observe, enabled });

  function update(): void {
    const now = Date.now();
    const msSince = now - lastActive;
    const isIdle = msSince >= idleAfterMs;
    const secondsSinceActive = Math.floor(msSince / 1000);
    snapshot = {
      isIdle,
      isActive: !isIdle,
      lastActiveAt: new Date(lastActive).toISOString(),
      idleSeconds: isIdle ? secondsSinceActive : 0,
      secondsSinceActive,
    };
    result.notifyChanged();
  }

  function markActive(): void {
    lastActive = Date.now();
    update();
  }

  if (autoTrack) {
    onMount(() => {
      activityEvents.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));
      timer = setInterval(update, 5000);
    });
    onDestroy(() => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, markActive));
      if (timer) clearInterval(timer);
    });
  }

  return { ...result, markActive, get snapshot() { return snapshot; } };
}
