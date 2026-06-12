import { createEffect, onCleanup } from 'solid-js';
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
  /**
   * Accessor returning the scrollable container.
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

export type UseAskableScrollSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that exposes scroll position, reading depth, and active section
 * heading to AI assistants.
 *
 * @example
 * ```tsx
 * const [activeSection, setActiveSection] = createSignal<string | null>(null);
 *
 * useAskableScrollSource({ getActiveSection: activeSection });
 * ```
 */
export function useAskableScrollSource(
  options: UseAskableScrollSourceOptions = {},
): UseAskableScrollSourceResult {
  const {
    id = 'scroll',
    getElement: getElementOption,
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

  const getElement: () => Element | null | undefined = getElementOption
    ?? (selector ? () => document.querySelector(selector) : () => document.documentElement);

  const source = createAskableScrollSource({
    getElement,
    getActiveSection,
    describe,
    kind,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  if (autoTrack) {
    createEffect(() => {
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
      onCleanup(() => {
        (target as EventTarget).removeEventListener('scroll', notify);
        if (timeoutId) clearTimeout(timeoutId);
      });
    });
  }

  return result;
}
