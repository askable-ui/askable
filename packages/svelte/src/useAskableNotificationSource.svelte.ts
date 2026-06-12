import { createAskableNotificationSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateNotificationSourceOptions,
  AskableNotification,
  AskableNotificationSeverity,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableNotification, AskableNotificationSeverity };

export interface UseAskableNotificationSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateNotificationSourceOptions, 'getNotifications'> {
  /** Source registration id. Defaults to "notifications". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Getter returning the current notifications array.
   * Track this with `$effect` or reactive Svelte state.
   */
  notifications?: () => readonly AskableNotification[];
}

export type UseAskableNotificationSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that registers a notification context source.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableNotificationSource } from '@askable-ui/svelte/useAskableNotificationSource.svelte';
 *
 *   let toasts = $state<AskableNotification[]>([]);
 *   useAskableNotificationSource({ notifications: () => toasts });
 * </script>
 * ```
 */
export function useAskableNotificationSource(
  options: UseAskableNotificationSourceOptions = {},
): UseAskableNotificationSource {
  const {
    id = 'notifications',
    ctx,
    notifications,
    maxNotifications,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const notifSource = createAskableNotificationSource({
    getNotifications: () => notifications?.() ?? [],
    maxNotifications,
    describe,
    kind,
  });

  const result = useAskableSource(id, {
    ...notifSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  $effect(() => {
    notifications?.();
    result.notifyChanged();
  });

  return result;
}
