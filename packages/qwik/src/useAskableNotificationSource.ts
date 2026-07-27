import { $, useSignal } from '@builder.io/qwik';
import type { QRL, SyncQRL } from '@builder.io/qwik';
import { createAskableNotificationSource } from '@askable-ui/core';
import type {
  AskableCreateNotificationSourceOptions,
  AskableNotification,
  AskableNotificationSeverity,
} from '@askable-ui/core';
import {
  useAskableSource,
  type UseAskableSourceOptions,
  type UseAskableSourceResult,
} from './useAskableSource.js';

export type { AskableNotification, AskableNotificationSeverity };

export interface UseAskableNotificationSourceOptions
  extends UseAskableSourceOptions,
    Pick<AskableCreateNotificationSourceOptions, 'kind'> {
  id?: string;
  maxEntries?: number;
  describe?: SyncQRL<NonNullable<AskableCreateNotificationSourceOptions['describe']>>;
}

export interface UseAskableNotificationSourceResult extends UseAskableSourceResult {
  notifications: ReturnType<typeof useSignal<AskableNotification[]>>;
  push: QRL<(notification: Omit<AskableNotification, 'id' | 'timestamp'>) => Promise<void>>;
  dismiss: QRL<(id: string) => Promise<void>>;
  clear: QRL<() => Promise<void>>;
}

/**
 * Registers a notification source that tracks active toasts, alerts, and
 * banners so the AI can reference them.
 *
 * ```tsx
 * const notifications = useAskableNotificationSource();
 * <button onClick$={() => notifications.push({
 *   message: 'Order placed!',
 *   severity: 'success',
 * })}>Notify</button>
 * ```
 */
export function useAskableNotificationSource(
  options: UseAskableNotificationSourceOptions = {},
): UseAskableNotificationSourceResult {
  const {
    id = 'notifications',
    enabled,
    ctx,
    ctx$,
    name,
    events,
    viewport,
    textExtractor,
    sanitizeMeta,
    sanitizeText,
    sanitizeSource,
    maxHistory,
    maxEntries = 20,
    describe,
    kind,
  } = options;

  const notifications = useSignal<AskableNotification[]>([]);
  const nextId = useSignal(1);
  const sourceFactory = $(async () => createAskableNotificationSource({
    describe: await describe?.resolve(),
    kind,
    getNotifications: () => notifications.value,
  }));
  const result = useAskableSource(id, sourceFactory, {
    enabled, ctx, ctx$, name, events, viewport, textExtractor,
    sanitizeMeta, sanitizeText, sanitizeSource, maxHistory,
  });
  const notifyChanged = result.notifyChanged;

  const push = $(async (
    notification: Omit<AskableNotification, 'id' | 'timestamp'>,
  ): Promise<void> => {
    const entry: AskableNotification = {
      ...notification,
      id: String(nextId.value++),
      timestamp: new Date().toISOString(),
    };
    const next = [entry, ...notifications.value];
    notifications.value = next.length > maxEntries ? next.slice(0, maxEntries) : next;
    await notifyChanged();
  });

  const dismiss = $(async (entryId: string): Promise<void> => {
    notifications.value = notifications.value.filter((notification) => notification.id !== entryId);
    await notifyChanged();
  });

  const clear = $(async (): Promise<void> => {
    notifications.value = [];
    await notifyChanged();
  });

  return Object.assign(result, { notifications, push, dismiss, clear });
}
