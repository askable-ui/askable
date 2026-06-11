import { createAskablePageSource } from '@askable-ui/core';
import type { AskableContext, AskableCreatePageSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export interface UseAskablePageSourceOptions
  extends AskableCreatePageSourceOptions,
    UseAskableSourceOptions {
  /** Source registration id. Defaults to "page". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
}

export type UseAskablePageSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that registers a page source capturing
 * the current document title, URL, headings, selected text, and optional links.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskablePageSource } from '@askable-ui/svelte/useAskablePageSource.svelte';
 *
 *   const { toPromptContext } = useAskablePageSource({ includeLinks: true });
 * </script>
 * ```
 */
export function useAskablePageSource(
  options: UseAskablePageSourceOptions = {},
): UseAskablePageSource {
  const {
    id = 'page',
    ctx,
    observe,
    enabled,
    describe,
    kind,
    root,
    includeLinks,
    maxLinks,
    maxHeadings,
    maxTextLength,
    textExtractor,
    sanitizeText,
    ...ctxOptions
  } = options;

  const pageSource = createAskablePageSource({
    describe,
    kind,
    root,
    includeLinks,
    maxLinks,
    maxHeadings,
    maxTextLength,
    textExtractor,
    sanitizeText,
  });

  return useAskableSource(id, {
    ...pageSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });
}
