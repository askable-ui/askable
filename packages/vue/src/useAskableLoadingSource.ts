import { ref, type MaybeRef } from 'vue';
import { createAskableLoadingSource } from '@askable-ui/core';
import type {
  AskableCreateLoadingSourceOptions,
  AskableLoadingStatus,
  AskableLoadingEntry,
  AskableLoadingSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableLoadingStatus, AskableLoadingEntry, AskableLoadingSourceSnapshot };

export interface UseAskableLoadingSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateLoadingSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "loading". */
  id?: string;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableLoadingSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableLoadingSourceSnapshot | null>>;
  start: (key: string) => void;
  finish: (key: string) => void;
  error: (key: string, message?: string) => void;
  clear: (key: string) => void;
}

function buildSnapshot(ops: Map<string, AskableLoadingEntry>): AskableLoadingSourceSnapshot {
  const operations = Array.from(ops.values());
  const loading = operations.filter((o) => o.status === 'loading').map((o) => o.key);
  const loaded = operations.filter((o) => o.status === 'loaded').map((o) => o.key);
  const errored = operations.filter((o) => o.status === 'error').map((o) => o.key);
  return { operations, loading, loaded, errored, isLoading: loading.length > 0, activeCount: loading.length };
}

/**
 * Vue composable that tracks named loading operations and exposes them to AI
 * assistants so they can explain why the UI is loading and diagnose slow requests.
 *
 * @example
 * ```ts
 * const { start, finish, error } = useAskableLoadingSource();
 * start('users');
 * try { await fetchUsers(); finish('users'); } catch (e) { error('users', e.message); }
 * ```
 */
export function useAskableLoadingSource(
  options: UseAskableLoadingSourceOptions = {},
): UseAskableLoadingSourceResult {
  const { id = 'loading', describe, kind, enabled, ctx, name, events } = options;

  const ops = new Map<string, AskableLoadingEntry>();
  const snapshot = ref<AskableLoadingSourceSnapshot | null>(null);

  const source = createAskableLoadingSource({
    describe,
    kind,
    getSnapshot: () => snapshot.value,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function update(): void {
    snapshot.value = buildSnapshot(ops);
    result.notifyChanged();
  }

  function start(key: string): void {
    ops.set(key, { key, status: 'loading', startedAt: new Date().toISOString(), completedAt: null, durationMs: null, error: null });
    update();
  }

  function finish(key: string): void {
    const existing = ops.get(key);
    const now = new Date().toISOString();
    const startedAt = existing?.startedAt ?? now;
    ops.set(key, { key, status: 'loaded', startedAt, completedAt: now, durationMs: new Date(now).getTime() - new Date(startedAt).getTime(), error: null });
    update();
  }

  function error(key: string, message?: string): void {
    const existing = ops.get(key);
    const now = new Date().toISOString();
    const startedAt = existing?.startedAt ?? now;
    ops.set(key, { key, status: 'error', startedAt, completedAt: now, durationMs: new Date(now).getTime() - new Date(startedAt).getTime(), error: message ?? 'Unknown error' });
    update();
  }

  function clear(key: string): void {
    ops.delete(key);
    update();
  }

  return { ...result, snapshot, start, finish, error, clear };
}
