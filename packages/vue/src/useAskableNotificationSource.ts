import { watch, type MaybeRef, toValue } from 'vue';
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
   * Current notifications as a `Ref<AskableNotification[]>` or a plain array.
   * The hook watches this value and auto-notifies on change.
   */
  notifications?: MaybeRef<readonly AskableNotification[]>;
  enabled?: MaybeRef<boolean>;
}

export type UseAskableNotificationSourceResult = UseAskableSourceResult;

/**
 * Vue composable that registers a notification context source — exposing active toasts,
 * alerts, and banners to AI assistants.
 *
 * @example
 * ```ts
 * const notifications = ref<AskableNotification[]>([]);
 * useAskableNotificationSource({ notifications });
 *
 * // Add a toast
 * function showError(message: string) {
 *   notifications.value.push({ id: Date.now().toString(), message, severity: 'error' });
 * }
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
    getNotifications: () => toValue(notifications) ?? [],
    maxNotifications,
    describe,
    kind,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  if (notifications !== undefined) {
    watch(() => toValue(notifications), () => result.notifyChanged(), { deep: true });
  }

  return result;
}
