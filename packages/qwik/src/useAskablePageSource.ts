import { createAskablePageSource } from '@askable-ui/core';
import type { AskableCreatePageSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskablePageSourceOptions
  extends UseAskableSourceOptions,
    AskableCreatePageSourceOptions {
  id?: string;
}

export type UseAskablePageSourceResult = UseAskableSourceResult;

/**
 * Registers a page source that captures the current document title, URL,
 * meta description, headings, and optionally links.
 *
 * ```tsx
 * export const Layout = component$(() => {
 *   useAskablePageSource();
 *   return <Slot />;
 * });
 * ```
 */
export function useAskablePageSource(options: UseAskablePageSourceOptions = {}): UseAskablePageSourceResult {
  const { id = 'page', enabled, ctx, name, events, describe, kind, root, includeLinks, maxLinks, maxHeadings, maxTextLength, textExtractor, sanitizeText } = options;
  const source = createAskablePageSource({ describe, kind, root, includeLinks, maxLinks, maxHeadings, maxTextLength, textExtractor, sanitizeText });
  return useAskableSource(id, source, { enabled, ctx, name, events });
}
