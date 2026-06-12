import { useEffect, useMemo, useRef } from 'react';
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
    AskableCreateScrollSourceOptions {
  /** Source registration id. Defaults to "scroll". */
  id?: string;
  /**
   * React ref pointing to the scrollable container.
   * Takes priority over `selector` and `getElement`.
   */
  ref?: React.RefObject<Element | null>;
  /**
   * CSS selector for the scrollable container.
   * Used when `ref` is not provided.
   */
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
 * React hook that exposes scroll position, reading depth, and active section
 * heading to AI assistants — so they know exactly what content the user is
 * looking at without any screenshot.
 *
 * @example
 * ```tsx
 * // Page-level scroll
 * const [activeSection, setActiveSection] = useState<string | null>(null);
 *
 * useAskableScrollSource({
 *   getActiveSection: () => activeSection,
 * });
 *
 * // Container scroll
 * const containerRef = useRef<HTMLDivElement>(null);
 * useAskableScrollSource({ ref: containerRef, id: 'sidebar-scroll' });
 * ```
 */
export function useAskableScrollSource(
  options: UseAskableScrollSourceOptions = {},
): UseAskableScrollSourceResult {
  const {
    id = 'scroll',
    ref,
    selector,
    getElement: getElementProp,
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

  const refRef = useRef(ref);
  refRef.current = ref;

  const getActiveSectionRef = useRef(getActiveSection);
  getActiveSectionRef.current = getActiveSection;

  const getElementPropRef = useRef(getElementProp);
  getElementPropRef.current = getElementProp;

  const getElement = useMemo<() => Element | null | undefined>(() => {
    if (ref) return () => refRef.current?.current ?? null;
    if (selector) return () => document.querySelector(selector);
    if (getElementProp) return () => getElementPropRef.current?.() ?? null;
    return () => document.documentElement;
  }, [ref, selector, !!getElementProp]);

  const source = useMemo(
    () => createAskableScrollSource({
      getElement,
      getActiveSection: () => getActiveSectionRef.current?.() ?? null,
      describe,
      kind,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  useEffect(() => {
    if (!autoTrack) return;

    const target = getElement() ?? window;
    const eventTarget = target === document.documentElement ? window : target;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const notify = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        result.notifyChanged();
      }, throttleMs);
    };

    eventTarget.addEventListener('scroll', notify, { passive: true });
    return () => {
      eventTarget.removeEventListener('scroll', notify);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [autoTrack, getElement, result, throttleMs]);

  return result;
}
