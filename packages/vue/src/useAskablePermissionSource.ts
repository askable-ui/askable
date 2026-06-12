import { ref, onMounted, type MaybeRef } from 'vue';
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
  /** Query permissions on mount. @default true */
  autoQuery?: MaybeRef<boolean>;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskablePermissionSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskablePermissionSourceSnapshot | null>>;
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
 * Vue composable that queries browser permission states and exposes them to
 * AI assistants.
 *
 * @example
 * ```ts
 * const { snapshot } = useAskablePermissionSource({
 *   permissions: ['camera', 'microphone'],
 * });
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

  const snapshot = ref<AskablePermissionSourceSnapshot | null>(null);

  const source = createAskablePermissionSource({
    getSnapshot: () => snapshot.value,
    describe,
    kind,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const refresh = async () => {
    const entries = await queryAll(permissions);
    snapshot.value = toSnapshot(entries);
    result.notifyChanged();
  };

  onMounted(() => {
    if (autoQuery) refresh();
  });

  return { ...result, snapshot, refresh };
}
