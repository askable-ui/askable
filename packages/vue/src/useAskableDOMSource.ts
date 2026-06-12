import { onMounted, onUnmounted, type MaybeRef, toValue } from 'vue';
import type { Ref } from 'vue';
import { createAskableDOMSource } from '@askable-ui/core';
import type { AskableCreateDOMSourceOptions, AskableDOMSnapshot } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableDOMSnapshot };

export interface UseAskableDOMSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateDOMSourceOptions, 'getElement'> {
  /** Source registration id. Defaults to "dom". */
  id?: string;
  /** Vue template ref pointing to the target element. */
  elementRef?: Ref<Element | null | undefined>;
  /** CSS selector to locate the target element. */
  selector?: string;
  /**
   * When true, sets up a MutationObserver and notifies automatically on content changes.
   * @default false
   */
  observeChanges?: boolean;
  /** Reactive enabled flag. */
  enabled?: MaybeRef<boolean>;
}

export type UseAskableDOMSourceResult = UseAskableSourceResult;

/**
 * Vue composable that captures any DOM element's text content, labels, roles,
 * and attributes as AI context.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useTemplateRef } from 'vue';
 * import { useAskableDOMSource } from '@askable-ui/vue';
 *
 * const editorEl = useTemplateRef('editor');
 * useAskableDOMSource({
 *   elementRef: editorEl,
 *   id: 'editor',
 *   observeChanges: true,
 * });
 * </script>
 * <template>
 *   <div ref="editor" contenteditable>Type here…</div>
 * </template>
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
    if (elementRef) return toValue(elementRef);
    if (selector) return document.querySelector(selector);
    return null;
  };

  const source = createAskableDOMSource({ getElement, includeAttributes, includeHTML, maxTextLength, describe, kind });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let observer: MutationObserver | null = null;

  onMounted(() => {
    if (!observeChanges) return;
    const el = getElement();
    if (!el) return;
    observer = new MutationObserver(() => result.notifyChanged());
    observer.observe(el, { childList: true, characterData: true, subtree: true });
  });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
  });

  return result;
}
