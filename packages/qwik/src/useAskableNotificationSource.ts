import { useSignal } from '@builder.io/qwik';
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
    Pick<AskableCreateNotificationSourceOptions, 'describe' | 'kind'> {
  id?: string;
  maxEntries?: number;
}

export interface UseAskableNotificationSourceResult extends UseAskableSourceResult {
  notifications: ReturnType<typeof useSignal<AskableNotification[]>>;
  push(notification: Omit<AskableNotification, 'id' | 'timestamp'>): void;
  dismiss(id: string): void;
  clear(): void;
}

/**
 * Registers a notification source that tracks active toasts, alerts, and
 * banners so the AI can reference them.
 *
 * ```tsx
 * const { push, dismiss } = useAskableNotificationSource();
 * push({ message: 'Order placed!', severity: 'success' });
 * ```
 */
export function useAskableNotificationSource(
  options: UseAskableNotificationSourceOptions = {},
): UseAskableNotificationSourceResult {
  const { id = 'notifications', enabled, ctx, name, events, maxEntries = 20, describe, kind } = options;

  const notifications = useSignal<AskableNotification[]>([]);
  let nextId = 1;

  const source = createAskableNotificationSource({
    describe,
    kind,
    getNotifications: () => notifications.value,
  });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function push(notification: Omit<AskableNotification, 'id' | 'timestamp'>): void {
    const entry: AskableNotification = {
      ...notification,
      id: String(nextId++),
      timestamp: new Date().toISOString(),
    };
    const next = [entry, ...notifications.value];
    notifications.value = next.length > maxEntries ? next.slice(0, maxEntries) : next;
    result.notifyChanged();
  }

  function dismiss(id: string): void {
    notifications.value = notifications.value.filter((n) => n.id !== id);
    result.notifyChanged();
  }

  function clear(): void {
    notifications.value = [];
    result.notifyChanged();
  }

  return { ...result, notifications, push, dismiss, clear };
}
