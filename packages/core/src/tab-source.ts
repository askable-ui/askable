import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export type AskableTabVisibility = 'visible' | 'hidden' | 'prerender';

export interface AskableTabSourceSnapshot {
  /** Current tab visibility state. */
  visibility: AskableTabVisibility;
  /** Whether the tab is currently visible to the user. */
  isVisible: boolean;
  /** Whether the tab is hidden (user switched away or minimized the window). */
  isHidden: boolean;
  /** ISO timestamp when the tab became visible. */
  visibleSince: string | null;
  /** ISO timestamp when the tab was last hidden. */
  hiddenSince: string | null;
  /** Total number of times the tab became hidden since tracking started. */
  hideCount: number;
  /** How many seconds the tab has been hidden in the current session (approximate). */
  hiddenSeconds: number;
}

export interface AskableCreateTabSourceOptions {
  /**
   * Returns the current tab snapshot. Called each time the source is resolved.
   * The framework hook manages Page Visibility API events; this getter reads them.
   */
  getSnapshot: () => AskableTabSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableTabSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "tab". */
  kind?: string;
}

function defaultDescribe(snap: AskableTabSourceSnapshot): string {
  if (snap.isVisible) {
    const parts = ['Tab is visible.'];
    if (snap.hideCount > 0) parts.push(`Hidden ${snap.hideCount} time${snap.hideCount !== 1 ? 's' : ''} this session.`);
    return parts.join(' ');
  }
  const mins = Math.floor(snap.hiddenSeconds / 60);
  const secs = snap.hiddenSeconds % 60;
  const dur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  return `Tab is hidden (${dur}).`;
}

/**
 * Creates a source that exposes browser tab visibility state to AI assistants
 * using the Page Visibility API — so they know when users switch away from the
 * page and understand why real-time features may have paused.
 *
 * @example
 * ```ts
 * // AI: "I noticed you switched away from this tab for 3 minutes.
 * //      The live data feed paused while you were away."
 * ```
 */
export function createAskableTabSource(
  options: AskableCreateTabSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'tab',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'Tab visibility unavailable.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'Tab visibility unavailable.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        isVisible: snap?.isVisible ?? true,
        isHidden: snap?.isHidden ?? false,
        hideCount: snap?.hideCount ?? 0,
        hiddenSeconds: snap?.hiddenSeconds ?? 0,
      };
    },
    data: () => options.getSnapshot(),
  });
}
