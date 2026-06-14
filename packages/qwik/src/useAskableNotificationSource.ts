import { useSignal, useVisibleTask$ } from '@builder.io/qwik';
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
    Omit<AskableCreateNotificationSourceOptions, 'getSnapshot'> {
  id?: string;
  maxEntries?: number;
}

export interface UseAskableNotificationSourceResult extends UseAskableSourceResult {
  push(notification: Omit<AskableNotification, 'id' | 'timestamp'>): void;
  dismiss(id: string): void;
  clear(): void;
}

/**
 * Registers a notification source that tracks active toasts, alerts, and
 * banners so the AI can reference them.
 *
 * ```tsx
 * const notifs = useAskableNotificationSource();
 * notifs.push({ message: 'Order placed!', severity: 'success' });
 * ```
 */
export function useAskableNotificationSource(
  options: UseAskableNotificationSourceOptions = {},
): UseAskableNotificationSourceResult {
  const { id = 'notifications', enabled, ctx, name, events, maxEntries = 20, describe, kind } = options;

  const items = useSignal<AskableNotification[]>([]);
  let nextId = 1;

  function push(notification: Omit<AskableNotification, 'id' | 'timestamp'>): void {
    const entry: AskableNotification = {
      ...notification,
      id: String(nextId++),
      timestamp: new Date().toISOString(),
    };
    const next = [entry, ...items.value];
    items.value = next.length > maxEntries ? next.slice(0, maxEntries) : next;
  }

  function dismiss(id: string): void {
    items.value = items.value.filter((n) => n.id !== id);
  }

  function clear(): void {
    items.value = [];
  }

  const source = createAskableNotificationSource({ describe, kind, getSnapshot: () => ({ notifications: items.value, count: items.value.length }) });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  return { ...result, push, dismiss, clear };
}
