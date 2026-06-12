import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export type AskableLoadingStatus = 'loading' | 'loaded' | 'error' | 'idle';

export interface AskableLoadingEntry {
  /** Key identifying this loading operation (e.g. "users", "/api/reports"). */
  key: string;
  /** Current status of this operation. */
  status: AskableLoadingStatus;
  /** ISO timestamp when loading started. */
  startedAt: string | null;
  /** ISO timestamp when loading completed (success or error). */
  completedAt: string | null;
  /** How many milliseconds the operation took (null if still loading). */
  durationMs: number | null;
  /** Error message if status is "error". */
  error: string | null;
}

export interface AskableLoadingSourceSnapshot {
  /** All tracked loading operations. */
  operations: AskableLoadingEntry[];
  /** Keys of operations currently loading. */
  loading: string[];
  /** Keys of operations that completed successfully. */
  loaded: string[];
  /** Keys of operations that errored. */
  errored: string[];
  /** Whether any operation is currently in progress. */
  isLoading: boolean;
  /** Number of currently active loading operations. */
  activeCount: number;
}

export interface AskableCreateLoadingSourceOptions {
  /**
   * Returns the current loading snapshot. Called each time the source is
   * resolved. The framework hook manages the loading state; this getter reads it.
   */
  getSnapshot: () => AskableLoadingSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableLoadingSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "loading". */
  kind?: string;
}

function defaultDescribe(snap: AskableLoadingSourceSnapshot): string {
  const hasAny = snap.operations.length > 0 || snap.loading.length > 0 || snap.errored.length > 0 || snap.loaded.length > 0;
  if (!hasAny) return 'No loading operations tracked.';
  if (!snap.isLoading) {
    const errCount = snap.errored.length;
    if (errCount > 0) return `All operations completed. ${errCount} error${errCount !== 1 ? 's' : ''}: ${snap.errored.join(', ')}.`;
    return `All operations completed successfully.`;
  }
  const active = snap.loading.join(', ');
  const parts = [`${snap.activeCount} operation${snap.activeCount !== 1 ? 's' : ''} loading: ${active}.`];
  if (snap.errored.length > 0) parts.push(`Errors: ${snap.errored.join(', ')}.`);
  return parts.join(' ');
}

/**
 * Creates a source that exposes named loading operation states to AI assistants
 * so they can explain why the UI is loading, diagnose slow requests, and
 * describe error states.
 *
 * @example
 * ```ts
 * const { start, finish, error } = useAskableLoadingSource();
 *
 * async function fetchUsers() {
 *   start('users');
 *   try {
 *     const data = await api.getUsers();
 *     finish('users');
 *     return data;
 *   } catch (e) {
 *     error('users', e.message);
 *   }
 * }
 * ```
 */
export function createAskableLoadingSource(
  options: AskableCreateLoadingSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'loading',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'No loading operations tracked.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'No loading operations tracked.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        isLoading: snap?.isLoading ?? false,
        activeCount: snap?.activeCount ?? 0,
        errorCount: snap?.errored.length ?? 0,
      };
    },
    data: () => options.getSnapshot(),
  });
}
