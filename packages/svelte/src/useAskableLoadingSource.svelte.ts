import { createAskableLoadingSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateLoadingSourceOptions,
  AskableLoadingStatus,
  AskableLoadingEntry,
  AskableLoadingSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableLoadingStatus, AskableLoadingEntry, AskableLoadingSourceSnapshot };

export interface UseAskableLoadingSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateLoadingSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "loading". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
}

export interface UseAskableLoadingSource extends UseAskableSource {
  start: (key: string) => void;
  finish: (key: string) => void;
  error: (key: string, message?: string) => void;
  clear: (key: string) => void;
  readonly snapshot: AskableLoadingSourceSnapshot | null;
}

function buildSnapshot(ops: Map<string, AskableLoadingEntry>): AskableLoadingSourceSnapshot {
  const operations = Array.from(ops.values());
  const loading = operations.filter((o) => o.status === 'loading').map((o) => o.key);
  const loaded = operations.filter((o) => o.status === 'loaded').map((o) => o.key);
  const errored = operations.filter((o) => o.status === 'error').map((o) => o.key);
  return { operations, loading, loaded, errored, isLoading: loading.length > 0, activeCount: loading.length };
}

/**
 * Svelte 5 runes-based composable that tracks named loading operations and
 * exposes them to AI assistants so they can explain why the UI is loading,
 * diagnose slow requests, and describe error states.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableLoadingSource } from '@askable-ui/svelte/useAskableLoadingSource.svelte';
 *   const { start, finish, error } = useAskableLoadingSource();
 * </script>
 * ```
 */
export function useAskableLoadingSource(
  options: UseAskableLoadingSourceOptions = {},
): UseAskableLoadingSource {
  const { id = 'loading', ctx, describe, kind, observe, enabled, ...ctxOptions } = options;

  const ops = new Map<string, AskableLoadingEntry>();
  let snapshot = $state<AskableLoadingSourceSnapshot | null>(null);

  const loadingSource = createAskableLoadingSource({
    describe,
    kind,
    getSnapshot: () => snapshot,
  });

  const result = useAskableSource(id, { ...loadingSource, ...ctxOptions, ctx, observe, enabled });

  function update(): void {
    snapshot = buildSnapshot(ops);
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

  return { ...result, start, finish, error, clear, get snapshot() { return snapshot; } };
}
