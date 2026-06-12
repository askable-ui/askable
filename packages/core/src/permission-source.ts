import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export type AskablePermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';

export type AskablePermissionName =
  | 'camera'
  | 'microphone'
  | 'notifications'
  | 'geolocation'
  | 'clipboard-read'
  | 'clipboard-write'
  | 'push'
  | 'storage-access'
  | 'screen-wake-lock'
  | 'midi'
  | 'ambient-light-sensor'
  | 'accelerometer'
  | 'gyroscope'
  | 'magnetometer';

export interface AskablePermissionEntry {
  name: AskablePermissionName;
  state: AskablePermissionState;
}

export interface AskablePermissionSourceSnapshot {
  /** All queried permissions and their states. */
  permissions: AskablePermissionEntry[];
  /** Permissions that have been granted. */
  granted: AskablePermissionName[];
  /** Permissions that have been denied. */
  denied: AskablePermissionName[];
  /** Permissions awaiting a prompt (not yet decided). */
  prompt: AskablePermissionName[];
  /** Permissions not available in this browser. */
  unavailable: AskablePermissionName[];
}

export interface AskableCreatePermissionSourceOptions {
  /**
   * List of permissions to query.
   * @default ['camera', 'microphone', 'notifications', 'geolocation']
   */
  permissions?: AskablePermissionName[];
  /**
   * Provides a pre-resolved snapshot (useful for SSR or when the Permissions API
   * is not available). When provided, skips the async query.
   */
  getSnapshot?: () => AskablePermissionSourceSnapshot | null;
  /** Custom describe function. */
  describe?: (snapshot: AskablePermissionSourceSnapshot) => string;
  /** Source category. Defaults to "permissions". */
  kind?: string;
}

const DEFAULT_PERMISSIONS: AskablePermissionName[] = ['camera', 'microphone', 'notifications', 'geolocation'];

function defaultDescribe(snapshot: AskablePermissionSourceSnapshot): string {
  const lines: string[] = [];

  if (snapshot.granted.length > 0) {
    lines.push(`Granted: ${snapshot.granted.join(', ')}`);
  }
  if (snapshot.denied.length > 0) {
    lines.push(`Denied: ${snapshot.denied.join(', ')}`);
  }
  if (snapshot.prompt.length > 0) {
    lines.push(`Not yet decided: ${snapshot.prompt.join(', ')}`);
  }
  if (snapshot.unavailable.length > 0) {
    lines.push(`Unavailable: ${snapshot.unavailable.join(', ')}`);
  }

  return lines.length > 0 ? `Browser permissions:\n${lines.join('\n')}` : 'No permissions queried.';
}

async function queryPermissions(
  names: AskablePermissionName[],
): Promise<AskablePermissionEntry[]> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return names.map((name) => ({ name, state: 'unavailable' as AskablePermissionState }));
  }

  const results = await Promise.allSettled(
    names.map(async (name) => {
      try {
        const status = await navigator.permissions.query({ name: name as PermissionName });
        return { name, state: status.state as AskablePermissionState };
      } catch {
        return { name, state: 'unavailable' as AskablePermissionState };
      }
    }),
  );

  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { name: names[i], state: 'unavailable' as AskablePermissionState },
  );
}

function snapshotFromEntries(entries: AskablePermissionEntry[]): AskablePermissionSourceSnapshot {
  const granted: AskablePermissionName[] = [];
  const denied: AskablePermissionName[] = [];
  const prompt: AskablePermissionName[] = [];
  const unavailable: AskablePermissionName[] = [];

  for (const entry of entries) {
    if (entry.state === 'granted') granted.push(entry.name);
    else if (entry.state === 'denied') denied.push(entry.name);
    else if (entry.state === 'prompt') prompt.push(entry.name);
    else unavailable.push(entry.name);
  }

  return { permissions: entries, granted, denied, prompt, unavailable };
}

/**
 * Creates a permission context source that exposes browser permission states —
 * camera, microphone, notifications, geolocation, and others — so AI assistants
 * can explain why a feature isn't working ("your microphone access is denied")
 * and guide users through granting permissions.
 *
 * Uses the Permissions API asynchronously; framework hooks call `resolve()` to
 * get up-to-date permission state.
 *
 * @example
 * ```ts
 * const source = createAskablePermissionSource({
 *   permissions: ['camera', 'microphone', 'notifications'],
 * });
 * ctx.registerSource('permissions', source);
 * ```
 */
export function createAskablePermissionSource(
  options: AskableCreatePermissionSourceOptions = {},
): AskableContextSource {
  const {
    permissions = DEFAULT_PERMISSIONS,
    getSnapshot,
    describe,
    kind = 'permissions',
  } = options;

  const resolveSnapshot = async (): Promise<AskablePermissionSourceSnapshot> => {
    if (getSnapshot) return getSnapshot() ?? snapshotFromEntries(permissions.map((n) => ({ name: n, state: 'unavailable' })));
    const entries = await queryPermissions(permissions);
    return snapshotFromEntries(entries);
  };

  return createAskableSource({
    kind,
    describe: describe
      ? async () => describe(await resolveSnapshot())
      : async () => defaultDescribe(await resolveSnapshot()),
    state: async () => {
      const s = await resolveSnapshot();
      return {
        granted: s.granted,
        denied: s.denied,
        hasBlockedPermissions: s.denied.length > 0,
      };
    },
    data: async () => resolveSnapshot(),
  });
}
