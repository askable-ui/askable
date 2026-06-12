import { createAskablePermissionSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreatePermissionSourceOptions,
  AskablePermissionEntry,
  AskablePermissionName,
  AskablePermissionSourceSnapshot,
  AskablePermissionState,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskablePermissionEntry, AskablePermissionName, AskablePermissionState, AskablePermissionSourceSnapshot };

export interface UseAskablePermissionSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreatePermissionSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "permissions". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Query permissions on mount. @default true */
  autoQuery?: boolean;
}

export interface UseAskablePermissionSource extends UseAskableSource {
  /** Manually re-query all permissions. */
  refresh: () => Promise<void>;
  /** Returns the current permission snapshot ($state). */
  readonly snapshot: AskablePermissionSourceSnapshot | null;
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
 * Svelte 5 runes-based composable that queries browser permission states and
 * exposes them to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskablePermissionSource } from '@askable-ui/svelte/useAskablePermissionSource.svelte';
 *   const { snapshot } = useAskablePermissionSource({ permissions: ['camera', 'microphone'] });
 * </script>
 * ```
 */
export function useAskablePermissionSource(
  options: UseAskablePermissionSourceOptions = {},
): UseAskablePermissionSource {
  const {
    id = 'permissions',
    permissions = DEFAULT_PERMISSIONS,
    autoQuery = true,
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let snapshot = $state<AskablePermissionSourceSnapshot | null>(null);

  const permissionSource = createAskablePermissionSource({
    getSnapshot: () => snapshot,
    describe,
    kind,
  });

  const result = useAskableSource(id, {
    ...permissionSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  const refresh = async () => {
    const entries = await queryAll(permissions);
    snapshot = toSnapshot(entries);
    result.notifyChanged();
  };

  if (autoQuery) {
    $effect(() => {
      void refresh();
    });
  }

  return {
    ...result,
    refresh,
    get snapshot() { return snapshot; },
  };
}
