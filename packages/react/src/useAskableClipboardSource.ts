import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAskableClipboardSource } from '@askable-ui/core';
import type {
  AskableCreateClipboardSourceOptions,
  AskableClipboardEntry,
  AskableClipboardSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableClipboardEntry, AskableClipboardSourceSnapshot };

export interface UseAskableClipboardSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateClipboardSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "clipboard". */
  id?: string;
  /**
   * Listen to the `copy` DOM event and capture clipboard text automatically.
   * Does not require Clipboard API permission.
   * @default true
   */
  autoTrack?: boolean;
  /**
   * Maximum number of clipboard history entries to retain.
   * @default 10
   */
  maxHistory?: number;
  /**
   * Maximum characters per clipboard entry.
   * @default 5000
   */
  maxLength?: number;
}

export interface UseAskableClipboardSourceResult extends UseAskableSourceResult {
  /** Manually add a clipboard entry (useful when reading from navigator.clipboard). */
  addEntry: (text: string, source?: AskableClipboardEntry['source']) => void;
  /** Current clipboard snapshot. */
  snapshot: AskableClipboardSourceSnapshot | null;
}

/**
 * React hook that exposes what the user has most recently copied to the clipboard
 * so AI assistants can reference it directly — no UI changes needed.
 *
 * Captures text from DOM `copy` events (no permission required). Optionally
 * call `addEntry()` after reading `navigator.clipboard.readText()` for full
 * clipboard access.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableClipboardSource();
 *
 * // AI can now see: "Clipboard: 'the text the user copied'"
 * ```
 */
export function useAskableClipboardSource(
  options: UseAskableClipboardSourceOptions = {},
): UseAskableClipboardSourceResult {
  const {
    id = 'clipboard',
    autoTrack = true,
    maxHistory = 10,
    maxLength = 5000,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const [snapshot, setSnapshot] = useState<AskableClipboardSourceSnapshot | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const addEntry = useCallback((text: string, source: AskableClipboardEntry['source'] = 'copy-event') => {
    if (!text.trim()) return;
    const truncated = text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
    const entry: AskableClipboardEntry = {
      text: truncated,
      copiedAt: new Date().toISOString(),
      source,
    };
    setSnapshot((prev) => {
      const history = [entry, ...(prev?.history ?? [])].slice(0, maxHistory);
      return { current: entry, history, total: (prev?.total ?? 0) + 1 };
    });
  }, [maxHistory, maxLength]);

  const coreSource = useMemo(
    () => createAskableClipboardSource({
      getSnapshot: () => snapshotRef.current,
      describe,
      kind,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, coreSource, { enabled, ctx, name, events });

  // Notify context when snapshot changes
  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;
  useEffect(() => {
    notifyRef.current();
  }, [snapshot]);

  // Auto-capture from copy events
  useEffect(() => {
    if (!autoTrack) return;
    const handler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text) addEntry(text, 'copy-event');
    };
    document.addEventListener('copy', handler);
    return () => document.removeEventListener('copy', handler);
  }, [autoTrack, addEntry]);

  return { ...result, addEntry, snapshot };
}
