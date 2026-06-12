import { createAskableClipboardSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateClipboardSourceOptions,
  AskableClipboardEntry,
  AskableClipboardSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableClipboardEntry, AskableClipboardSourceSnapshot };

export interface UseAskableClipboardSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateClipboardSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "clipboard". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
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

export interface UseAskableClipboardSource extends UseAskableSource {
  /** Manually add a clipboard entry. */
  addEntry: (text: string, source?: AskableClipboardEntry['source']) => void;
  /** Returns the current clipboard snapshot ($state). */
  readonly snapshot: AskableClipboardSourceSnapshot | null;
}

/**
 * Svelte 5 runes-based composable that exposes what the user has most recently
 * copied to the clipboard to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableClipboardSource } from '@askable-ui/svelte/useAskableClipboardSource.svelte';
 *   const { snapshot } = useAskableClipboardSource();
 *   // snapshot?.current?.text — most recently copied text
 * </script>
 * ```
 */
export function useAskableClipboardSource(
  options: UseAskableClipboardSourceOptions = {},
): UseAskableClipboardSource {
  const {
    id = 'clipboard',
    ctx,
    autoTrack = true,
    maxHistory = 10,
    maxLength = 5000,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let snapshot = $state<AskableClipboardSourceSnapshot | null>(null);

  const clipboardSource = createAskableClipboardSource({
    getSnapshot: () => snapshot,
    describe,
    kind,
  });

  const result = useAskableSource(id, {
    ...clipboardSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  function addEntry(text: string, source: AskableClipboardEntry['source'] = 'copy-event'): void {
    if (!text.trim()) return;
    const truncated = text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
    const entry: AskableClipboardEntry = {
      text: truncated,
      copiedAt: new Date().toISOString(),
      source,
    };
    const history = [entry, ...(snapshot?.history ?? [])].slice(0, maxHistory);
    snapshot = { current: entry, history, total: (snapshot?.total ?? 0) + 1 };
    result.notifyChanged();
  }

  if (autoTrack) {
    $effect(() => {
      const handler = (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text/plain');
        if (text) addEntry(text, 'copy-event');
      };
      document.addEventListener('copy', handler);
      return () => document.removeEventListener('copy', handler);
    });
  }

  return {
    ...result,
    addEntry,
    get snapshot() { return snapshot; },
  };
}
