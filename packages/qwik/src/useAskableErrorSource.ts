import { createAskableErrorSource } from '@askable-ui/core';
import type { AskableCreateErrorSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskableErrorSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateErrorSourceOptions {
  id?: string;
}

export type UseAskableErrorSourceResult = UseAskableSourceResult;

/**
 * Registers an error source that captures recent application errors
 * so the AI can reference them in responses.
 *
 * ```tsx
 * const { notifyChanged } = useAskableErrorSource();
 * // call notifyChanged() after catching an error
 * ```
 */
export function useAskableErrorSource(options: UseAskableErrorSourceOptions = {}): UseAskableErrorSourceResult {
  const { id = 'errors', enabled, ctx, name, events, ...sourceOptions } = options;
  const source = createAskableErrorSource(sourceOptions);
  return useAskableSource(id, source, { enabled, ctx, name, events });
}
