import { createEffect, onCleanup } from 'solid-js';
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
   * Accessor returning the target element (e.g. from `createRef`).
   * When provided, the hook auto-notifies when the element changes.
   */
  elementRef?: () => Element | null | undefined;
  /** CSS selector to locate the target element. */
  selector?: string;
  /**
   * When true, sets up a MutationObserver and notifies automatically on content changes.
   * @default false
   */
  observeChanges?: boolean;
}

export type UseAskableDOMSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that captures any DOM element's text content, labels, roles,
 * and attributes as AI context.
 *
 * @example
 * ```tsx
 * let editorEl: HTMLDivElement;
 * useAskableDOMSource({
 *   elementRef: () => editorEl,
 *   id: 'editor',
 *   observeChanges: true,
 * });
 * return <div ref={editorEl} contenteditable>Type here…</div>;
 * ```
 */
export function useAskableDOMSource(
  options: UseAskableDOMSourceOptions = {},
): UseAskableDOMSourceResult {
  const {
    id = 'dom',
    elementRef,
    selector,
    observeChanges = false,
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

  const getElement = (): Element | null | undefined => {
    if (elementRef) return elementRef();
    if (selector) return document.querySelector(selector);
    return null;
  };

  const source = createAskableDOMSource({ getElement, includeAttributes, includeHTML, maxTextLength, describe, kind });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  if (observeChanges) {
    createEffect(() => {
      const el = getElement();
      if (!el) return;
      const observer = new MutationObserver(() => result.notifyChanged());
      observer.observe(el, { childList: true, characterData: true, subtree: true });
      onCleanup(() => observer.disconnect());
    });
  }

  return result;
}
