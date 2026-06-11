import { createAskablePageSource } from '@askable-ui/core';
import type { AskableCreatePageSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskablePageSourceOptions
  extends UseAskableSourceOptions,
    AskableCreatePageSourceOptions {
  /** Source registration id. Defaults to "page". */
  id?: string;
}

export type UseAskablePageSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that registers a page source capturing the current
 * document title, URL, headings, selected text, and optional links.
 *
 * ```tsx
 * const { toPromptContext } = useAskablePageSource({ includeLinks: true });
 *
 * <button onClick={async () => {
 *   const prompt = await toPromptContext();
 *   // send to your LLM
 * }}>Ask AI</button>
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

  return useAskableSource(id, pageSource, { enabled, ctx, name, events });
}
