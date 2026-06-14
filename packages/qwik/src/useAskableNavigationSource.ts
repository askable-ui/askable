import { createAskableNavigationSource } from '@askable-ui/core';
import type { AskableCreateNavigationSourceOptions, AskableNavigationEntry } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableNavigationEntry };

export interface UseAskableNavigationSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateNavigationSourceOptions {
  id?: string;
}

export type UseAskableNavigationSourceResult = UseAskableSourceResult;

/**
 * Registers a navigation source that tracks page route history.
 *
 * ```tsx
 * useAskableNavigationSource({ maxEntries: 5 });
 * ```
 */
export function useAskableNavigationSource(options: UseAskableNavigationSourceOptions = {}): UseAskableNavigationSourceResult {
  const { id = 'navigation', enabled, ctx, name, events, ...sourceOptions } = options;
  const source = createAskableNavigationSource(sourceOptions);
  return useAskableSource(id, source, { enabled, ctx, name, events });
}
