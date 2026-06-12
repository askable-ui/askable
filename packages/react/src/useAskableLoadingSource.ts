import { useCallback, useMemo, useRef, useState } from 'react';
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
}

export interface UseAskableLoadingSourceResult extends UseAskableSourceResult {
  /** Current loading snapshot. */
  snapshot: AskableLoadingSourceSnapshot | null;
  /** Mark an operation as loading. */
  start: (key: string) => void;
  /** Mark an operation as successfully completed. */
  finish: (key: string) => void;
  /** Mark an operation as errored. */
  error: (key: string, message?: string) => void;
  /** Remove an operation from tracking. */
  clear: (key: string) => void;
}

function buildSnapshot(ops: Map<string, AskableLoadingEntry>): AskableLoadingSourceSnapshot {
  const operations = Array.from(ops.values());
  const loading = operations.filter((o) => o.status === 'loading').map((o) => o.key);
  const loaded = operations.filter((o) => o.status === 'loaded').map((o) => o.key);
  const errored = operations.filter((o) => o.status === 'error').map((o) => o.key);
  return {
    operations,
    loading,
    loaded,
    errored,
    isLoading: loading.length > 0,
    activeCount: loading.length,
  };
}

/**
 * React hook that tracks named loading operations and exposes them to AI
 * assistants so they can explain why the UI is loading, diagnose slow requests,
 * and describe error states.
 *
 * @example
 * ```tsx
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
export function useAskableLoadingSource(
  options: UseAskableLoadingSourceOptions = {},
): UseAskableLoadingSourceResult {
  const {
    id = 'loading',
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const opsRef = useRef(new Map<string, AskableLoadingEntry>());
  const [snapshot, setSnapshot] = useState<AskableLoadingSourceSnapshot | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () =>
      createAskableLoadingSource({
        describe,
        kind,
        getSnapshot: () => snapshotRef.current,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  const update = useCallback(() => {
    const snap = buildSnapshot(opsRef.current);
    setSnapshot(snap);
    notifyRef.current();
  }, []);

  const start = useCallback((key: string) => {
    opsRef.current.set(key, {
      key,
      status: 'loading',
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: null,
      error: null,
    });
    update();
  }, [update]);

  const finish = useCallback((key: string) => {
    const existing = opsRef.current.get(key);
    const now = new Date().toISOString();
    const startedAt = existing?.startedAt ?? now;
    opsRef.current.set(key, {
      key,
      status: 'loaded',
      startedAt,
      completedAt: now,
      durationMs: new Date(now).getTime() - new Date(startedAt).getTime(),
      error: null,
    });
    update();
  }, [update]);

  const error = useCallback((key: string, message?: string) => {
    const existing = opsRef.current.get(key);
    const now = new Date().toISOString();
    const startedAt = existing?.startedAt ?? now;
    opsRef.current.set(key, {
      key,
      status: 'error',
      startedAt,
      completedAt: now,
      durationMs: new Date(now).getTime() - new Date(startedAt).getTime(),
      error: message ?? 'Unknown error',
    });
    update();
  }, [update]);

  const clear = useCallback((key: string) => {
    opsRef.current.delete(key);
    update();
  }, [update]);

  return { ...result, snapshot, start, finish, error, clear };
}
