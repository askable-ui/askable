import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAskablePermissionSource } from '@askable-ui/core';
import type {
  AskableCreatePermissionSourceOptions,
  AskablePermissionEntry,
  AskablePermissionName,
  AskablePermissionSourceSnapshot,
  AskablePermissionState,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskablePermissionEntry, AskablePermissionName, AskablePermissionState, AskablePermissionSourceSnapshot };

export interface UseAskablePermissionSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreatePermissionSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "permissions". */
  id?: string;
  /**
   * Query permissions on mount and whenever the list changes.
   * @default true
   */
  autoQuery?: boolean;
}

export interface UseAskablePermissionSourceResult extends UseAskableSourceResult {
  /** Current permission snapshot (null until first query completes). */
  snapshot: AskablePermissionSourceSnapshot | null;
  /** Manually re-query all permissions. */
  refresh: () => Promise<void>;
}

const DEFAULT_PERMISSIONS: AskablePermissionName[] = ['camera', 'microphone', 'notifications', 'geolocation'];

async function queryAll(names: AskablePermissionName[]): Promise<AskablePermissionEntry[]> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return names.map((n) => ({ name: n, state: 'unavailable' as AskablePermissionState }));
  }
  return Promise.all(
    names.map(async (name) => {
      try {
        const s = await navigator.permissions.query({ name: name as PermissionName });
        return { name, state: s.state as AskablePermissionState };
      } catch {
        return { name, state: 'unavailable' as AskablePermissionState };
      }
    }),
  );
}

function toSnapshot(entries: AskablePermissionEntry[]): AskablePermissionSourceSnapshot {
  const granted: AskablePermissionName[] = [];
  const denied: AskablePermissionName[] = [];
  const prompt: AskablePermissionName[] = [];
  const unavailable: AskablePermissionName[] = [];
  for (const e of entries) {
    if (e.state === 'granted') granted.push(e.name);
    else if (e.state === 'denied') denied.push(e.name);
    else if (e.state === 'prompt') prompt.push(e.name);
    else unavailable.push(e.name);
  }
  return { permissions: entries, granted, denied, prompt, unavailable };
}

/**
 * React hook that queries browser permission states — camera, microphone,
 * notifications, geolocation — so AI assistants can explain why a feature
 * isn't working and guide users through granting access.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskablePermissionSource({
 *   permissions: ['camera', 'microphone'],
 * });
 *
 * // AI: "Your microphone is denied — click the lock icon to enable it."
 * ```
 */
export function useAskablePermissionSource(
  options: UseAskablePermissionSourceOptions = {},
): UseAskablePermissionSourceResult {
  const {
    id = 'permissions',
    permissions = DEFAULT_PERMISSIONS,
    autoQuery = true,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const [snapshot, setSnapshot] = useState<AskablePermissionSourceSnapshot | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () => createAskablePermissionSource({
      getSnapshot: () => snapshotRef.current,
      describe,
      kind,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  const refresh = useCallback(async () => {
    const entries = await queryAll(permissions);
    const snap = toSnapshot(entries);
    setSnapshot(snap);
    notifyRef.current();
  }, [permissions]);

  useEffect(() => {
    if (autoQuery) {
      refresh();
    }
  }, [autoQuery, refresh]);

  return { ...result, snapshot, refresh };
}
