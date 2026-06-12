import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableIdleSourceSnapshot {
  /** Whether the user is currently considered idle. */
  isIdle: boolean;
  /** Whether the user is currently active. */
  isActive: boolean;
  /** ISO timestamp of the last detected user activity. */
  lastActiveAt: string | null;
  /** How many seconds the user has been idle (0 if active). */
  idleSeconds: number;
  /** How many seconds since the last activity event. */
  secondsSinceActive: number;
}

export interface AskableCreateIdleSourceOptions {
  /**
   * Returns the current idle snapshot. Called each time the source is resolved.
   * The framework hook manages idle detection; this getter reads the state.
   */
  getSnapshot: () => AskableIdleSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableIdleSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "idle". */
  kind?: string;
}

function defaultDescribe(snap: AskableIdleSourceSnapshot): string {
  if (snap.isActive) return 'User is active.';
  const mins = Math.floor(snap.idleSeconds / 60);
  const secs = snap.idleSeconds % 60;
  if (mins > 0) return `User has been idle for ${mins}m ${secs}s.`;
  return `User has been idle for ${secs}s.`;
}

/**
 * Creates a source that exposes user idle state to AI assistants so they can
 * understand session inactivity, trigger context-aware prompts, or explain
 * why a session expired.
 *
 * @example
 * ```ts
 * const { setActive, setIdle } = useAskableIdleSource({ idleAfterMs: 5 * 60 * 1000 });
 * // AI: "The user has been idle for 8 minutes. Their session may expire soon."
 * ```
 */
export function createAskableIdleSource(
  options: AskableCreateIdleSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'idle',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'Idle state unavailable.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'Idle state unavailable.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        isIdle: snap?.isIdle ?? false,
        idleSeconds: snap?.idleSeconds ?? 0,
        secondsSinceActive: snap?.secondsSinceActive ?? 0,
      };
    },
    data: () => options.getSnapshot(),
  });
}
