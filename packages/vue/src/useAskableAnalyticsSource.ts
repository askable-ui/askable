import { ref, type MaybeRef } from 'vue';
import { createAskableAnalyticsSource } from '@askable-ui/core';
import type {
  AskableCreateAnalyticsSourceOptions,
  AskableAnalyticsEvent,
  AskableAnalyticsSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableAnalyticsEvent, AskableAnalyticsSourceSnapshot };

export interface UseAskableAnalyticsSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateAnalyticsSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "analytics". */
  id?: string;
  /** Maximum events to retain in history. @default 50 */
  maxEvents?: MaybeRef<number>;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableAnalyticsSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableAnalyticsSourceSnapshot | null>>;
  track: (name: string, properties?: Record<string, unknown>) => void;
}

/**
 * Vue composable that exposes recent analytics events to AI assistants so they
 * understand the user's journey before asking for help.
 *
 * @example
 * ```ts
 * const { track } = useAskableAnalyticsSource();
 * track('checkout_started', { items: cart.value.length });
 * ```
 */
export function useAskableAnalyticsSource(
  options: UseAskableAnalyticsSourceOptions = {},
): UseAskableAnalyticsSourceResult {
  const {
    id = 'analytics',
    maxEvents = 50,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const snapshot = ref<AskableAnalyticsSourceSnapshot | null>(null);

  const source = createAskableAnalyticsSource({
    describe,
    kind,
    getSnapshot: () => snapshot.value,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const max = typeof maxEvents === 'number' ? maxEvents : 50;

  function track(eventName: string, properties?: Record<string, unknown>): void {
    const entry: AskableAnalyticsEvent = {
      name: eventName,
      properties,
      recordedAt: new Date().toISOString(),
    };
    const existing = snapshot.value?.events ?? [];
    const updated = [entry, ...existing].slice(0, max);
    snapshot.value = {
      events: updated,
      total: (snapshot.value?.total ?? 0) + 1,
      latestEvent: eventName,
    };
    result.notifyChanged();
  }

  return { ...result, snapshot, track };
}
