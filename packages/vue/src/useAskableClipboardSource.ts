import { ref, onMounted, onUnmounted, type MaybeRef, toValue } from 'vue';
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
  autoTrack?: MaybeRef<boolean>;
  /** Maximum history entries to retain. @default 10 */
  maxHistory?: number;
  /** Maximum characters per entry. @default 5000 */
  maxLength?: number;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableClipboardSourceResult extends UseAskableSourceResult {
  /** Manually add a clipboard entry. */
  addEntry: (text: string, source?: AskableClipboardEntry['source']) => void;
  /** Reactive clipboard snapshot. */
  snapshot: ReturnType<typeof ref<AskableClipboardSourceSnapshot | null>>;
}

/**
 * Vue composable that exposes what the user has most recently copied.
 *
 * @example
 * ```ts
 * const { snapshot } = useAskableClipboardSource();
 * // snapshot.value?.current?.text — most recently copied text
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

  const snapshot = ref<AskableClipboardSourceSnapshot | null>(null);

  const addEntry = (text: string, source: AskableClipboardEntry['source'] = 'copy-event') => {
    if (!text.trim()) return;
    const truncated = text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
    const entry: AskableClipboardEntry = {
      text: truncated,
      copiedAt: new Date().toISOString(),
      source,
    };
    const prev = snapshot.value;
    const history = [entry, ...(prev?.history ?? [])].slice(0, maxHistory);
    snapshot.value = { current: entry, history, total: (prev?.total ?? 0) + 1 };
    result.notifyChanged();
  };

  const coreSource = createAskableClipboardSource({
    getSnapshot: () => snapshot.value,
    describe,
    kind,
  });

  const result = useAskableSource(id, coreSource, { enabled, ctx, name, events });

  let cleanup: (() => void) | null = null;

  onMounted(() => {
    if (!toValue(autoTrack)) return;
    const handler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text) addEntry(text, 'copy-event');
    };
    document.addEventListener('copy', handler);
    cleanup = () => document.removeEventListener('copy', handler);
  });

  onUnmounted(() => {
    cleanup?.();
    cleanup = null;
  });

  return { ...result, addEntry, snapshot };
}
