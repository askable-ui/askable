import { createAskableSelectionSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateSelectionSourceOptions,
  AskableSelectionSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableSelectionSourceSnapshot };

export interface UseAskableSelectionSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateSelectionSourceOptions {
  /** Source registration id. Defaults to "selection". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Automatically register a `selectionchange` listener and notify on change.
   * @default true
   */
  autoTrack?: boolean;
}

export type UseAskableSelectionSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that exposes the user's current text selection
 * to AI assistants — selected text, surrounding context, and the containing element.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableSelectionSource } from '@askable-ui/svelte/useAskableSelectionSource.svelte';
 *   useAskableSelectionSource({ maxLength: 2000 });
 * </script>
 * ```
 */
export function useAskableSelectionSource(
  options: UseAskableSelectionSourceOptions = {},
): UseAskableSelectionSource {
  const {
    id = 'selection',
    ctx,
    autoTrack = true,
    maxLength,
    surroundingChars,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const selectionSource = createAskableSelectionSource({ maxLength, surroundingChars, describe, kind });

  const result = useAskableSource(id, {
    ...selectionSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  if (autoTrack) {
    $effect(() => {
      const notify = () => result.notifyChanged();
      document.addEventListener('selectionchange', notify);
      return () => document.removeEventListener('selectionchange', notify);
    });
  }

  return result;
}
