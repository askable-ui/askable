import { onMount, onDestroy } from 'svelte';
import { createAskableDOMSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateDOMSourceOptions,
  AskableDOMSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableDOMSnapshot };

export interface UseAskableDOMSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateDOMSourceOptions, 'getElement'> {
  /** Source registration id. Defaults to "dom". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Getter returning the target element (e.g. from a Svelte 5 `$bindable` ref).
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

export type UseAskableDOMSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that captures any DOM element's text content,
 * labels, roles, and attributes as AI context.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableDOMSource } from '@askable-ui/svelte/useAskableDOMSource.svelte';
 *
 *   let editorEl = $state<HTMLDivElement>();
 *   useAskableDOMSource({ elementRef: () => editorEl, id: 'editor', observeChanges: true });
 * </script>
 * <div bind:this={editorEl} contenteditable>Type here…</div>
 * ```
 */
export function useAskableDOMSource(
  options: UseAskableDOMSourceOptions = {},
): UseAskableDOMSource {
  const {
    id = 'dom',
    ctx,
    elementRef,
    selector,
    observeChanges = false,
    includeAttributes,
    includeHTML,
    maxTextLength,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const getElement = (): Element | null | undefined => {
    if (elementRef) return elementRef();
    if (selector) return document.querySelector(selector);
    return null;
  };

  const domSource = createAskableDOMSource({ getElement, includeAttributes, includeHTML, maxTextLength, describe, kind });

  const result = useAskableSource(id, {
    ...domSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  let observer: MutationObserver | null = null;

  if (observeChanges) {
    onMount(() => {
      const el = getElement();
      if (!el) return;
      observer = new MutationObserver(() => result.notifyChanged());
      observer.observe(el, { childList: true, characterData: true, subtree: true });
    });

    onDestroy(() => {
      observer?.disconnect();
      observer = null;
    });
  }

  return result;
}
