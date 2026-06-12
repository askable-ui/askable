import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export type AskableFeatureFlagValue = boolean | string | number;

export interface AskableFeatureFlagSourceSnapshot {
  /** All flags and their current values. */
  flags: Record<string, AskableFeatureFlagValue>;
  /** Names of flags that are enabled (boolean true or non-empty string/non-zero). */
  enabled: string[];
  /** Names of flags that are disabled (boolean false or empty string / zero). */
  disabled: string[];
}

export interface AskableCreateFeatureFlagSourceOptions {
  /**
   * Returns the current flag map. Called each time the source is resolved.
   * Compatible with LaunchDarkly allFlags(), PostHog featureFlags, GrowthBook,
   * Statsig, Unleash, or any custom flag object.
   */
  getFlags: () => Record<string, AskableFeatureFlagValue> | null | undefined;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableFeatureFlagSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "feature-flags". */
  kind?: string;
}

function isFlagEnabled(value: AskableFeatureFlagValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return value !== '' && value !== 'false' && value !== 'off' && value !== 'disabled';
}

function toSnapshot(raw: Record<string, AskableFeatureFlagValue>): AskableFeatureFlagSourceSnapshot {
  const enabled: string[] = [];
  const disabled: string[] = [];
  for (const [name, value] of Object.entries(raw)) {
    if (isFlagEnabled(value)) enabled.push(name);
    else disabled.push(name);
  }
  return { flags: raw, enabled, disabled };
}

function defaultDescribe(snap: AskableFeatureFlagSourceSnapshot): string {
  const total = Object.keys(snap.flags).length;
  if (total === 0) return 'No feature flags registered.';
  const parts: string[] = [`${total} feature flag${total !== 1 ? 's' : ''}.`];
  if (snap.enabled.length > 0) parts.push(`Enabled: ${snap.enabled.join(', ')}.`);
  if (snap.disabled.length > 0) parts.push(`Disabled: ${snap.disabled.join(', ')}.`);
  return parts.join(' ');
}

/**
 * Creates a source that exposes feature flag state to AI assistants so they
 * can explain why features are or aren't available — works with LaunchDarkly,
 * PostHog, GrowthBook, Statsig, Unleash, or any custom flag system.
 *
 * @example
 * ```ts
 * // LaunchDarkly
 * const flagSource = createAskableFeatureFlagSource({
 *   getFlags: () => ldClient.allFlags(),
 * });
 *
 * // PostHog
 * const flagSource = createAskableFeatureFlagSource({
 *   getFlags: () => posthog.featureFlags.getFlagVariants(),
 * });
 *
 * ctx.registerSource('flags', flagSource);
 * ```
 */
export function createAskableFeatureFlagSource(
  options: AskableCreateFeatureFlagSourceOptions,
): AskableContextSource {
  function resolve(): AskableFeatureFlagSourceSnapshot | null {
    const raw = options.getFlags();
    if (!raw) return null;
    return toSnapshot(raw);
  }

  return createAskableSource({
    kind: options.kind ?? 'feature-flags',
    describe: options.describe
      ? async () => {
          const snap = resolve();
          if (!snap) return 'No feature flags available.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = resolve();
          return snap ? defaultDescribe(snap) : 'No feature flags available.';
        },
    state: () => {
      const snap = resolve();
      if (!snap) return { totalCount: 0, enabledCount: 0, disabledCount: 0 };
      return {
        totalCount: Object.keys(snap.flags).length,
        enabledCount: snap.enabled.length,
        disabledCount: snap.disabled.length,
      };
    },
    data: resolve,
  });
}
