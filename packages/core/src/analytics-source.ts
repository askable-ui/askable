import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableAnalyticsEvent {
  /** Event name (e.g. "button_click", "page_view", "checkout_started"). */
  name: string;
  /** Event properties. */
  properties?: Record<string, unknown>;
  /** ISO timestamp when the event was recorded. */
  recordedAt: string;
}

export interface AskableAnalyticsSourceSnapshot {
  /** Most recent events, newest first. */
  events: AskableAnalyticsEvent[];
  /** Total events tracked since source was created (including those pruned from history). */
  total: number;
  /** Name of the most recent event, or null if no events yet. */
  latestEvent: string | null;
}

export interface AskableCreateAnalyticsSourceOptions {
  /**
   * Returns the current analytics snapshot. Called each time the source is
   * resolved. The framework hook manages the event buffer; this getter reads it.
   */
  getSnapshot: () => AskableAnalyticsSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableAnalyticsSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "analytics". */
  kind?: string;
}

function defaultDescribe(snap: AskableAnalyticsSourceSnapshot): string {
  if (snap.total === 0) return 'No analytics events tracked yet.';
  const recent = snap.events.slice(0, 5).map((e) => e.name).join(', ');
  return `${snap.total} event${snap.total !== 1 ? 's' : ''} tracked. Recent: ${recent}.`;
}

/**
 * Creates a source that exposes recent analytics events to AI assistants so
 * they understand the user's journey and can answer "what did I just do?" or
 * "why did this error appear?" questions in context.
 *
 * Compatible with any analytics system — Segment, Mixpanel, Amplitude,
 * PostHog, custom — by passing events through `track()`.
 *
 * @example
 * ```ts
 * const { track } = useAskableAnalyticsSource();
 *
 * // Wrap your existing analytics calls:
 * function trackEvent(name, props) {
 *   analytics.track(name, props); // your existing call
 *   track(name, props);           // also feed askable
 * }
 * ```
 */
export function createAskableAnalyticsSource(
  options: AskableCreateAnalyticsSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'analytics',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'No analytics events tracked yet.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'No analytics events tracked yet.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        total: snap?.total ?? 0,
        latestEvent: snap?.latestEvent ?? null,
        recentCount: snap?.events.length ?? 0,
      };
    },
    data: () => options.getSnapshot(),
  });
}
