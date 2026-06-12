import { ref, onMounted, onUnmounted, type MaybeRef } from 'vue';
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
  /** Milliseconds of inactivity before idle. @default 300000 (5 min) */
  idleAfterMs?: MaybeRef<number>;
  /** DOM events that reset the idle timer. */
  activityEvents?: string[];
  /** Automatically listen to activity events. @default true */
  autoTrack?: MaybeRef<boolean>;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableIdleSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableIdleSourceSnapshot | null>>;
  markActive: () => void;
}

const DEFAULT_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

/**
 * Vue composable that detects user idleness and exposes the state to AI
 * assistants so they can understand session inactivity.
 *
 * @example
 * ```ts
 * const { snapshot } = useAskableIdleSource({ idleAfterMs: 5 * 60 * 1000 });
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

  let lastActive = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;

  const snapshot = ref<AskableIdleSourceSnapshot | null>({
    isIdle: false,
    isActive: true,
    lastActiveAt: new Date().toISOString(),
    idleSeconds: 0,
    secondsSinceActive: 0,
  });

  const source = createAskableIdleSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const thresh = typeof idleAfterMs === 'number' ? idleAfterMs : 5 * 60 * 1000;

  function update(): void {
    const now = Date.now();
    const msSince = now - lastActive;
    const isIdle = msSince >= thresh;
    const secondsSinceActive = Math.floor(msSince / 1000);
    snapshot.value = {
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

  onMounted(() => {
    if (!autoTrack) return;
    activityEvents.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));
    timer = setInterval(update, 5000);
  });

  onUnmounted(() => {
    activityEvents.forEach((ev) => window.removeEventListener(ev, markActive));
    if (timer) clearInterval(timer);
  });

  return { ...result, snapshot, markActive };
}
