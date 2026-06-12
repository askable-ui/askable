import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export interface AskableClipboardEntry {
  /** Clipboard text content. */
  text: string;
  /** When the entry was captured (ISO 8601 string). */
  copiedAt: string;
  /** Origin of the copied text: "copy-event" when captured from the copy event,
   *  "clipboard-api" when read via navigator.clipboard. */
  source: 'copy-event' | 'clipboard-api';
}

export interface AskableClipboardSourceSnapshot {
  /** Most recently copied text, or null if clipboard is empty/unavailable. */
  current: AskableClipboardEntry | null;
  /** Recent clipboard history (newest first). */
  history: AskableClipboardEntry[];
  /** Total entries captured in this session. */
  total: number;
}

export interface AskableCreateClipboardSourceOptions {
  /**
   * Provides the current clipboard snapshot. Called on each resolve.
   * When omitted, the source returns null until the first copy event or
   * `addEntry()` is called from a framework hook.
   */
  getSnapshot?: () => AskableClipboardSourceSnapshot | null;
  /**
   * Maximum number of history entries to keep.
   * @default 10
   */
  maxHistory?: number;
  /**
   * Maximum characters to store per clipboard entry.
   * @default 5000
   */
  maxLength?: number;
  /** Custom describe function. */
  describe?: (snapshot: AskableClipboardSourceSnapshot) => string;
  /** Source category. Defaults to "clipboard". */
  kind?: string;
}

function defaultDescribe(snapshot: AskableClipboardSourceSnapshot): string {
  if (!snapshot.current) return 'Clipboard is empty.';

  const lines: string[] = [];
  lines.push(`Clipboard (${snapshot.current.source}):\n${snapshot.current.text}`);
  if (snapshot.total > 1) {
    lines.push(`\n${snapshot.total} items copied this session.`);
  }
  return lines.join('');
}

/**
 * Creates a clipboard context source that exposes what the user has recently
 * copied — so AI assistants can reference the clipboard contents directly.
 *
 * Clipboard entries are supplied via the `getSnapshot` option. Framework hooks
 * (`useAskableClipboardSource`) handle the copy-event listener and optionally
 * read the Clipboard API.
 *
 * @example
 * ```ts
 * let snapshot: AskableClipboardSourceSnapshot | null = null;
 *
 * const source = createAskableClipboardSource({
 *   getSnapshot: () => snapshot,
 * });
 * ctx.registerSource('clipboard', source);
 *
 * document.addEventListener('copy', (e) => {
 *   const text = e.clipboardData?.getData('text/plain') ?? '';
 *   snapshot = {
 *     current: { text, copiedAt: new Date().toISOString(), source: 'copy-event' },
 *     history: [{ text, copiedAt: new Date().toISOString(), source: 'copy-event' }],
 *     total: 1,
 *   };
 *   handle.notifyChanged();
 * });
 * ```
 */
export function createAskableClipboardSource(
  options: AskableCreateClipboardSourceOptions = {},
): AskableContextSource {
  const { getSnapshot, describe, kind = 'clipboard' } = options;

  const resolveSnapshot = (): AskableClipboardSourceSnapshot | null => {
    if (getSnapshot) return getSnapshot();
    return null;
  };

  return createAskableSource({
    kind,
    describe: describe
      ? () => {
          const s = resolveSnapshot();
          if (!s) return 'Clipboard is empty.';
          return describe(s);
        }
      : () => {
          const s = resolveSnapshot();
          if (!s) return 'Clipboard is empty.';
          return defaultDescribe(s);
        },
    state: () => {
      const s = resolveSnapshot();
      return {
        hasContent: s?.current != null,
        total: s?.total ?? 0,
      };
    },
    data: () => resolveSnapshot(),
  });
}
