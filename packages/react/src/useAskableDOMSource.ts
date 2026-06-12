import { useEffect, useMemo, useRef } from 'react';
import { createAskableDOMSource } from '@askable-ui/core';
import type { AskableCreateDOMSourceOptions, AskableDOMSnapshot } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableDOMSnapshot };

export interface UseAskableDOMSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateDOMSourceOptions, 'getElement'> {
  /** Source registration id. Defaults to "dom". */
  id?: string;
  /**
   * React ref pointing to the target element.
   * The hook automatically notifies when the ref's element changes.
   */
  ref?: React.RefObject<Element | null>;
  /**
   * CSS selector to locate the target element.
   * Used when `ref` is not provided.
   */
  selector?: string;
  /**
   * When true, the hook sets up a MutationObserver on the element and calls
   * `notifyChanged()` automatically when its content changes.
   * @default false
   */
  observe?: boolean;
}

export type UseAskableDOMSourceResult = UseAskableSourceResult;

/**
 * React hook that captures any DOM element's text content, labels, roles, and
 * attributes as AI context — perfect for rich text editors, custom widgets,
 * data grids, canvases, or any element that lacks dedicated source support.
 *
 * @example
 * ```tsx
 * // Capture a rich text editor
 * const editorRef = useRef<HTMLDivElement>(null);
 * useAskableDOMSource({
 *   ref: editorRef,
 *   id: 'editor',
 *   includeAttributes: ['contenteditable'],
 *   maxTextLength: 5000,
 *   observe: true, // auto-notify on content changes
 * });
 *
 * // Capture by CSS selector
 * useAskableDOMSource({
 *   selector: '#my-chart',
 *   id: 'chart',
 *   kind: 'chart',
 *   describe: (snap) => `Chart titled: ${snap.data.title}`,
 * });
 * ```
 */
export function useAskableDOMSource(
  options: UseAskableDOMSourceOptions = {},
): UseAskableDOMSourceResult {
  const {
    id = 'dom',
    ref,
    selector,
    observe: shouldObserve = false,
    includeAttributes,
    includeHTML,
    maxTextLength,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const refRef = useRef(ref);
  refRef.current = ref;

  const getElement = useMemo<() => Element | null | undefined>(() => {
    if (ref) return () => refRef.current?.current ?? null;
    if (selector) return () => document.querySelector(selector);
    return () => null;
  }, [ref, selector]);

  const source = useMemo(
    () => createAskableDOMSource({ getElement, includeAttributes, includeHTML, maxTextLength, describe, kind }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  // MutationObserver for auto-notify
  useEffect(() => {
    if (!shouldObserve) return;
    const el = getElement();
    if (!el) return;

    const observer = new MutationObserver(() => result.notifyChanged());
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [shouldObserve, getElement, result]);

  return result;
}
