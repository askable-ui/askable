import { useCallback, useMemo, useRef, useState } from 'react';
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
  /** Current analytics snapshot (null until first event). */
  snapshot: AskableAnalyticsSourceSnapshot | null;
  /**
   * Record a new analytics event. Call this alongside your existing analytics
   * calls (Segment, Mixpanel, PostHog, etc.) to feed context to AI assistants.
   */
  track: (name: string, properties?: Record<string, unknown>) => void;
}

/**
 * React hook that exposes recent analytics events to AI assistants so they
 * understand the user's journey — what they clicked, what pages they visited —
 * before asking for help.
 *
 * @example
 * ```tsx
 * const { track } = useAskableAnalyticsSource();
 *
 * // Wrap your existing analytics calls:
 * const handleCheckout = () => {
 *   segment.track('checkout_started', { items: cart.length });
 *   track('checkout_started', { items: cart.length });
 * };
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

  const [snapshot, setSnapshot] = useState<AskableAnalyticsSourceSnapshot | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () =>
      createAskableAnalyticsSource({
        describe,
        kind,
        getSnapshot: () => snapshotRef.current,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  const track = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
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
      notifyRef.current();
    },
    [maxEvents],
  );

  return { ...result, snapshot, track };
}
