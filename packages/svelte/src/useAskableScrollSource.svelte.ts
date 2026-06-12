import { createAskableScrollSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateScrollSourceOptions,
  AskableScrollState,
  AskableScrollSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableScrollState, AskableScrollSourceSnapshot };

export interface UseAskableScrollSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateScrollSourceOptions, 'getElement'> {
  /** Source registration id. Defaults to "scroll". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Getter returning the scrollable container.
   * Defaults to `document.documentElement` (the page itself).
   */
  getElement?: () => Element | null | undefined;
  /** CSS selector for the scrollable container (alternative to getElement). */
  selector?: string;
  /**
   * Automatically register a scroll listener and notify on change.
   * @default true
   */
  autoTrack?: boolean;
  /**
   * Throttle scroll events (milliseconds).
   * @default 100
   */
  throttleMs?: number;
}

export type UseAskableScrollSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that exposes scroll position, reading depth,
 * and active section heading to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableScrollSource } from '@askable-ui/svelte/useAskableScrollSource.svelte';
 *
 *   let activeSection = $state<string | null>(null);
 *   useAskableScrollSource({ getActiveSection: () => activeSection });
 * </script>
 * ```
 */
export function useAskableScrollSource(
  options: UseAskableScrollSourceOptions = {},
): UseAskableScrollSource {
  const {
    id = 'scroll',
    ctx,
    getElement: getElementOption,
    selector,
    autoTrack = true,
    throttleMs = 100,
    getActiveSection,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const getElement: () => Element | null | undefined = getElementOption
    ?? (selector ? () => document.querySelector(selector) : () => document.documentElement);

  const scrollSource = createAskableScrollSource({
    getElement,
    getActiveSection,
    describe,
    kind,
  });

  const result = useAskableSource(id, {
    ...scrollSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  if (autoTrack) {
    $effect(() => {
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
      return () => {
        (target as EventTarget).removeEventListener('scroll', notify);
        if (timeoutId) clearTimeout(timeoutId);
      };
    });
  }

  return result;
}
