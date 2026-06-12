import { useEffect, useMemo, useRef } from 'react';
import { createAskableNotificationSource } from '@askable-ui/core';
import type {
  AskableCreateNotificationSourceOptions,
  AskableNotification,
  AskableNotificationSeverity,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableNotification, AskableNotificationSeverity };

export interface UseAskableNotificationSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateNotificationSourceOptions, 'getNotifications'> {
  /** Source registration id. Defaults to "notifications". */
  id?: string;
  /**
   * Current notifications. Accepts:
   * - A static or reactive array of `AskableNotification` objects
   * - An accessor `() => AskableNotification[]`
   *
   * The hook auto-notifies when this array changes (by reference).
   */
  notifications?: readonly AskableNotification[] | (() => readonly AskableNotification[] | Promise<readonly AskableNotification[]>);
}

export type UseAskableNotificationSourceResult = UseAskableSourceResult;

/**
 * React hook that registers a notification context source — exposing active toast
 * messages, alerts, and banners to AI assistants.
 *
 * Compatible with react-toastify, Sonner, or any custom notification system.
 *
 * @example
 * ```tsx
 * // With Sonner
 * import { useToastStore } from 'sonner';
 *
 * const { notifyChanged } = useAskableNotificationSource({
 *   notifications: useToastStore((s) => s.toasts.map(t => ({
 *     id: t.id,
 *     message: t.title,
 *     severity: t.type,
 *   }))),
 * });
 *
 * // With a plain array
 * const [toasts, setToasts] = useState<AskableNotification[]>([]);
 * useAskableNotificationSource({ notifications: toasts });
 * ```
 */
export function useAskableNotificationSource(
  options: UseAskableNotificationSourceOptions = {},
): UseAskableNotificationSourceResult {
  const {
    id = 'notifications',
    notifications,
    maxNotifications,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  const source = useMemo(
    () => createAskableNotificationSource({
      getNotifications: () => {
        const n = notificationsRef.current;
        if (!n) return [];
        return typeof n === 'function' ? n() : n;
      },
      maxNotifications,
      describe,
      kind,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  useEffect(() => {
    if (notifications !== undefined) {
      result.notifyChanged();
    }
  }, [notifications, result]);

  return result;
}
