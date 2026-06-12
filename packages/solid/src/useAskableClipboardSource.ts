import { createSignal, createEffect, onCleanup } from 'solid-js';
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
   * @default true
   */
  autoTrack?: boolean;
  /** Maximum history entries to retain. @default 10 */
  maxHistory?: number;
  /** Maximum characters per entry. @default 5000 */
  maxLength?: number;
}

export interface UseAskableClipboardSourceResult extends UseAskableSourceResult {
  /** Manually add a clipboard entry. */
  addEntry: (text: string, source?: AskableClipboardEntry['source']) => void;
  /** Accessor returning the current clipboard snapshot. */
  snapshot: () => AskableClipboardSourceSnapshot | null;
}

/**
 * SolidJS primitive that exposes what the user has most recently copied.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableClipboardSource();
 * // snapshot()?.current?.text
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

  const [snapshot, setSnapshot] = createSignal<AskableClipboardSourceSnapshot | null>(null);

  const addEntry = (text: string, source: AskableClipboardEntry['source'] = 'copy-event') => {
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
    result.notifyChanged();
  };

  const coreSource = createAskableClipboardSource({
    getSnapshot: snapshot,
    describe,
    kind,
  });

  const result = useAskableSource(id, coreSource, { enabled, ctx, name, events });

  if (autoTrack) {
    createEffect(() => {
      const handler = (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text/plain');
        if (text) addEntry(text, 'copy-event');
      };
      document.addEventListener('copy', handler);
      onCleanup(() => document.removeEventListener('copy', handler));
    });
  }

  return { ...result, addEntry, snapshot };
}
