import { createAskableAnalyticsSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateAnalyticsSourceOptions,
  AskableAnalyticsEvent,
  AskableAnalyticsSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableAnalyticsEvent, AskableAnalyticsSourceSnapshot };

export interface UseAskableAnalyticsSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateAnalyticsSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "analytics". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Maximum events to retain in history. @default 50 */
  maxEvents?: number;
}

export interface UseAskableAnalyticsSource extends UseAskableSource {
  /** Manually add an analytics event. */
  track: (name: string, properties?: Record<string, unknown>) => void;
  /** Returns the current analytics snapshot ($state). */
  readonly snapshot: AskableAnalyticsSourceSnapshot | null;
}

/**
 * Svelte 5 runes-based composable that exposes recent analytics events to AI
 * assistants so they understand the user's journey before asking for help.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableAnalyticsSource } from '@askable-ui/svelte/useAskableAnalyticsSource.svelte';
 *   const { track } = useAskableAnalyticsSource();
 *   // track('checkout_started', { items: cart.length });
 * </script>
 * ```
 */
export function useAskableAnalyticsSource(
  options: UseAskableAnalyticsSourceOptions = {},
): UseAskableAnalyticsSource {
  const {
    id = 'analytics',
    maxEvents = 50,
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let snapshot = $state<AskableAnalyticsSourceSnapshot | null>(null);

  const analyticsSource = createAskableAnalyticsSource({
    describe,
    kind,
    getSnapshot: () => snapshot,
  });

  const result = useAskableSource(id, {
    ...analyticsSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  function track(eventName: string, properties?: Record<string, unknown>): void {
    const entry: AskableAnalyticsEvent = {
      name: eventName,
      properties,
      recordedAt: new Date().toISOString(),
    };
    const existing = snapshot?.events ?? [];
    const updated = [entry, ...existing].slice(0, maxEvents);
    snapshot = {
      events: updated,
      total: (snapshot?.total ?? 0) + 1,
      latestEvent: eventName,
    };
    result.notifyChanged();
  }

  return {
    ...result,
    track,
    get snapshot() { return snapshot; },
  };
}
