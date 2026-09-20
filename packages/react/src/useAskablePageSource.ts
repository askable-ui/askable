import { useMemo } from 'react';
import { createAskablePageSource } from '@askable-ui/core';
import type { AskableCreatePageSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskablePageSourceOptions
  extends Omit<UseAskableSourceOptions, 'textExtractor'>,
    AskableCreatePageSourceOptions {
  /** Source registration id. Defaults to "page". */
  id?: string;
}

export type UseAskablePageSourceResult = UseAskableSourceResult;

/**
 * Zero-config hook that registers a page source capturing the current
 * document title, URL, headings, selected text, and optional links.
 *
 * ```tsx
 * const { toPromptContext } = useAskablePageSource();
 *
 * // Later, when the user clicks "Ask AI":
 * const prompt = await toPromptContext();
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

  const pageSource = useMemo(
    () =>
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
    // useAskableSource keeps registration stable through its ref-backed proxy.
    [describe, kind, root, includeLinks, maxLinks, maxHeadings, maxTextLength, textExtractor, sanitizeText],
  );

  return useAskableSource(id, pageSource, { enabled, ctx, name, events });
}
