import { createSignal } from 'solid-js';
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
  maxEvents?: number;
}

export interface UseAskableAnalyticsSourceResult extends UseAskableSourceResult {
  snapshot: () => AskableAnalyticsSourceSnapshot | null;
  track: (name: string, properties?: Record<string, unknown>) => void;
}

/**
 * SolidJS primitive that exposes recent analytics events to AI assistants so
 * they understand the user's journey before asking for help.
 *
 * @example
 * ```tsx
 * const { track } = useAskableAnalyticsSource();
 * track('checkout_started', { items: cart().length });
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

  const [snapshot, setSnapshot] = createSignal<AskableAnalyticsSourceSnapshot | null>(null);

  const source = createAskableAnalyticsSource({
    describe,
    kind,
    getSnapshot: snapshot,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function track(eventName: string, properties?: Record<string, unknown>): void {
    const entry: AskableAnalyticsEvent = {
      name: eventName,
      properties,
      recordedAt: new Date().toISOString(),
    };
    setSnapshot((prev) => {
      const existing = prev?.events ?? [];
      const updated = [entry, ...existing].slice(0, maxEvents);
      return {
        events: updated,
        total: (prev?.total ?? 0) + 1,
        latestEvent: eventName,
      };
    });
    result.notifyChanged();
  }

  return { ...result, snapshot, track };
}
