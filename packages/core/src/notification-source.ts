import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export type AskableNotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AskableNotification {
  /** Unique identifier for this notification. */
  id: string;
  /** Notification message. */
  message: string;
  /** Severity level. Defaults to "info". */
  severity?: AskableNotificationSeverity;
  /** Optional notification title. */
  title?: string;
  /** ISO timestamp when the notification appeared. */
  timestamp?: string;
}

export interface AskableNotificationSourceSnapshot {
  /** All current notifications. */
  notifications: AskableNotification[];
  /** Notifications grouped by severity. */
  byLevel: {
    errors: AskableNotification[];
    warnings: AskableNotification[];
    successes: AskableNotification[];
    info: AskableNotification[];
  };
  total: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface AskableCreateNotificationSourceOptions {
  /**
   * Returns the current list of notifications.
   * Return an empty array when no notifications are active.
   */
  getNotifications: () => readonly AskableNotification[] | Promise<readonly AskableNotification[]>;
  /**
   * Maximum number of notifications to include in the snapshot.
   * @default 20
   */
  maxNotifications?: number;
  /** Custom describe function. */
  describe?: (snapshot: AskableNotificationSourceSnapshot) => string;
  /** Source category. Defaults to "notifications". */
  kind?: string;
}

function buildSnapshot(
  notifications: readonly AskableNotification[],
  maxNotifications: number,
): AskableNotificationSourceSnapshot {
  const capped = notifications.slice(0, maxNotifications);
  const errors = capped.filter((n) => (n.severity ?? 'info') === 'error');
  const warnings = capped.filter((n) => n.severity === 'warning');
  const successes = capped.filter((n) => n.severity === 'success');
  const info = capped.filter((n) => !n.severity || n.severity === 'info');

  return {
    notifications: capped as AskableNotification[],
    byLevel: { errors, warnings, successes, info },
    total: capped.length,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
  };
}

function defaultDescribe(snapshot: AskableNotificationSourceSnapshot): string {
  if (snapshot.total === 0) return 'No active notifications.';

  const lines: string[] = [`Active notifications (${snapshot.total}):`];

  for (const n of snapshot.notifications) {
    const level = n.severity ?? 'info';
    const header = n.title ? `[${level.toUpperCase()}] ${n.title}: ${n.message}` : `[${level.toUpperCase()}] ${n.message}`;
    lines.push(`- ${header}`);
  }

  return lines.join('\n');
}

/**
 * Creates a notification context source that exposes active toast messages,
 * banners, and alerts to AI assistants — so they can acknowledge errors, explain
 * success states, or guide users past warning messages.
 *
 * Compatible with react-toastify, Sonner, Vue toastification, any custom toast library,
 * or a plain reactive array.
 *
 * @example
 * ```ts
 * // With a reactive toast store
 * const notifSource = createAskableNotificationSource({
 *   getNotifications: () => toastStore.toasts.map(t => ({
 *     id: t.id,
 *     message: t.message,
 *     severity: t.type,
 *   })),
 * });
 * ctx.registerSource('notifications', notifSource);
 *
 * // Notify AI when toasts change
 * toastStore.subscribe(() => handle.notifyChanged());
 * ```
 */
export function createAskableNotificationSource(
  options: AskableCreateNotificationSourceOptions,
): AskableContextSource {
  const { getNotifications, maxNotifications = 20, describe, kind = 'notifications' } = options;

  async function resolveSnapshot(): Promise<AskableNotificationSourceSnapshot> {
    const notifications = await Promise.resolve(getNotifications());
    return buildSnapshot(notifications, maxNotifications);
  }

  return createAskableSource({
    kind,
    describe: describe
      ? async () => describe(await resolveSnapshot())
      : async () => defaultDescribe(await resolveSnapshot()),
    state: async () => {
      const snapshot = await resolveSnapshot();
      return {
        total: snapshot.total,
        hasErrors: snapshot.hasErrors,
        hasWarnings: snapshot.hasWarnings,
      };
    },
    data: async () => resolveSnapshot(),
  });
}
