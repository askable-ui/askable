import { onMounted, onUnmounted, type MaybeRef, toValue } from 'vue';
import { createAskableScrollSource } from '@askable-ui/core';
import type {
  AskableCreateScrollSourceOptions,
  AskableScrollState,
  AskableScrollSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableScrollState, AskableScrollSourceSnapshot };

export interface UseAskableScrollSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateScrollSourceOptions, 'getElement'> {
  /** Source registration id. Defaults to "scroll". */
  id?: string;
  /** Vue template ref pointing to the scrollable container. */
  elementRef?: { value: Element | null | undefined };
  /** CSS selector for the scrollable container. */
  selector?: string;
  /**
   * Automatically register a scroll listener and notify on change.
   * @default true
   */
  autoTrack?: MaybeRef<boolean>;
  /**
   * Throttle scroll events (milliseconds).
   * @default 100
   */
  throttleMs?: number;
  enabled?: MaybeRef<boolean>;
}

export type UseAskableScrollSourceResult = UseAskableSourceResult;

/**
 * Vue composable that exposes scroll position, reading depth, and active section
 * heading to AI assistants.
 *
 * @example
 * ```ts
 * const activeSection = ref<string | null>(null);
 *
 * useAskableScrollSource({
 *   getActiveSection: () => activeSection.value,
 * });
 * ```
 */
export function useAskableScrollSource(
  options: UseAskableScrollSourceOptions = {},
): UseAskableScrollSourceResult {
  const {
    id = 'scroll',
    elementRef,
    selector,
    autoTrack = true,
    throttleMs = 100,
    getActiveSection,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const getElement: () => Element | null | undefined = elementRef
    ? () => elementRef.value
    : selector
      ? () => document.querySelector(selector)
      : () => document.documentElement;

  const source = createAskableScrollSource({
    getElement,
    getActiveSection,
    describe,
    kind,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let cleanup: (() => void) | null = null;

  onMounted(() => {
    if (!toValue(autoTrack)) return;

    const el = getElement() ?? window;
    const target = el === document.documentElement ? window : el;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const notify = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        result.notifyChanged();
      }, throttleMs);
    };

    (target as EventTarget).addEventListener('scroll', notify, { passive: true } as AddEventListenerOptions);
    cleanup = () => {
      (target as EventTarget).removeEventListener('scroll', notify);
      if (timeoutId) clearTimeout(timeoutId);
    };
  });

  onUnmounted(() => {
    cleanup?.();
    cleanup = null;
  });

  return result;
}
