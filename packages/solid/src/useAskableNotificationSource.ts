import { createEffect } from 'solid-js';
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
   * Accessor returning the current notifications array.
   * The hook tracks this accessor and auto-notifies on change.
   */
  notifications?: () => readonly AskableNotification[];
}

export type UseAskableNotificationSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that registers a notification context source.
 *
 * @example
 * ```tsx
 * const [toasts, setToasts] = createSignal<AskableNotification[]>([]);
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

  const source = createAskableNotificationSource({
    getNotifications: () => notifications?.() ?? [],
    maxNotifications,
    describe,
    kind,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  if (notifications) {
    createEffect(() => {
      notifications();
      result.notifyChanged();
    });
  }

  return result;
}
