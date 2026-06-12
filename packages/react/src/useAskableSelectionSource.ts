import { useEffect, useMemo, useRef } from 'react';
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
 * React hook that exposes the user's current text selection to AI assistants —
 * selected text, surrounding context, and the containing element — so the AI
 * can reference exactly what the user is highlighting without any UI changes.
 *
 * @example
 * ```tsx
 * useAskableSelectionSource({ maxLength: 2000 });
 *
 * // AI can now see: "User has selected: 'important text' in a <p> element"
 * ```
 */
export function useAskableSelectionSource(
  options: UseAskableSelectionSourceOptions = {},
): UseAskableSelectionSourceResult {
  const {
    id = 'selection',
    autoTrack = true,
    getSelection,
    maxLength,
    surroundingChars,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const getSelectionRef = useRef(getSelection);
  getSelectionRef.current = getSelection;

  const source = useMemo(
    () => createAskableSelectionSource({
      getSelection: getSelectionRef.current ? () => getSelectionRef.current!() : undefined,
      maxLength,
      surroundingChars,
      describe,
      kind,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  useEffect(() => {
    if (!autoTrack) return;
    const notify = () => result.notifyChanged();
    document.addEventListener('selectionchange', notify);
    return () => document.removeEventListener('selectionchange', notify);
  }, [autoTrack, result]);

  return result;
}
