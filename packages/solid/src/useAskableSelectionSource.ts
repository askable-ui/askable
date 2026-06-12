import { createEffect, onCleanup } from 'solid-js';
import { createAskableSelectionSource } from '@askable-ui/core';
import type {
  AskableCreateSelectionSourceOptions,
  AskableSelectionSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableSelectionSourceSnapshot };

export interface UseAskableSelectionSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateSelectionSourceOptions {
  /** Source registration id. Defaults to "selection". */
  id?: string;
  /**
   * Automatically register a `selectionchange` listener and notify on change.
   * @default true
   */
  autoTrack?: boolean;
}

export type UseAskableSelectionSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that exposes the user's current text selection to AI assistants.
 *
 * @example
 * ```tsx
 * useAskableSelectionSource({ maxLength: 2000 });
 * ```
 */
export function useAskableSelectionSource(
  options: UseAskableSelectionSourceOptions = {},
): UseAskableSelectionSourceResult {
  const {
    id = 'selection',
    autoTrack = true,
    maxLength,
    surroundingChars,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = createAskableSelectionSource({ maxLength, surroundingChars, describe, kind });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  if (autoTrack) {
    createEffect(() => {
      const notify = () => result.notifyChanged();
      document.addEventListener('selectionchange', notify);
      onCleanup(() => document.removeEventListener('selectionchange', notify));
    });
  }

  return result;
}
