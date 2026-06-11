import { computed, type MaybeRef } from 'vue';
import { createAskablePageSource } from '@askable-ui/core';
import type { AskableCreatePageSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskablePageSourceOptions
  extends UseAskableSourceOptions,
    AskableCreatePageSourceOptions {
  /** Source registration id. Defaults to "page". */
  id?: string;
  /** Accept reactive enabled ref from parent. */
  enabled?: MaybeRef<boolean>;
}

export type UseAskablePageSourceResult = UseAskableSourceResult;

/**
 * Zero-config composable that registers a page source capturing the current
 * document title, URL, headings, selected text, and optional links.
 *
 * ```ts
 * const { toPromptContext } = useAskablePageSource();
 *
 * async function askAI() {
 *   const prompt = await toPromptContext();
 *   // send to your LLM
 * }
 * ```
 */
export function useAskablePageSource(
  options: UseAskablePageSourceOptions = {},
): UseAskablePageSourceResult {
  const {
    id = 'page',
    enabled,
    ctx,
    name,
    events,
    describe,
    kind,
    root,
    includeLinks,
    maxLinks,
    maxHeadings,
    maxTextLength,
    textExtractor,
    sanitizeText,
  } = options;

  const pageSource = computed(() =>
    createAskablePageSource({
      describe,
      kind,
      root,
      includeLinks,
      maxLinks,
      maxHeadings,
      maxTextLength,
      textExtractor,
      sanitizeText,
    }),
  );

  return useAskableSource(id, pageSource.value, { enabled, ctx, name, events });
}
