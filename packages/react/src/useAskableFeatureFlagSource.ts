import { useEffect, useMemo, useRef } from 'react';
import { createAskableFeatureFlagSource } from '@askable-ui/core';
import type {
  AskableCreateFeatureFlagSourceOptions,
  AskableFeatureFlagValue,
  AskableFeatureFlagSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableFeatureFlagValue, AskableFeatureFlagSourceSnapshot };

export interface UseAskableFeatureFlagSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateFeatureFlagSourceOptions, 'getFlags'> {
  /** Source registration id. Defaults to "feature-flags". */
  id?: string;
  /**
   * Current flag map. Accepts a plain object or a getter function.
   * Compatible with LaunchDarkly allFlags(), PostHog featureFlags,
   * GrowthBook, Statsig, Unleash, or any custom flag system.
   *
   * @example
   * // LaunchDarkly
   * flags={ldClient.allFlags()}
   * // PostHog
   * flags={() => posthog.featureFlags.getFlagVariants()}
   */
  flags?:
    | Record<string, AskableFeatureFlagValue>
    | null
    | undefined
    | (() => Record<string, AskableFeatureFlagValue> | null | undefined);
}

export type UseAskableFeatureFlagSourceResult = UseAskableSourceResult;

/**
 * React hook that exposes feature flag state to AI assistants so they can
 * explain why features are or aren't available. Works with LaunchDarkly,
 * PostHog, GrowthBook, Statsig, Unleash, or any custom flag system.
 *
 * @example
 * ```tsx
 * // LaunchDarkly
 * const flags = useFlags(); // LD React SDK
 * useAskableFeatureFlagSource({ flags });
 *
 * // PostHog
 * const flags = useFeatureFlagVariantKey ? {} : {};
 * useAskableFeatureFlagSource({ flags: () => posthog.featureFlags.getFlagVariants() });
 * ```
 */
export function useAskableFeatureFlagSource(
  options: UseAskableFeatureFlagSourceOptions = {},
): UseAskableFeatureFlagSourceResult {
  const {
    id = 'feature-flags',
    flags,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const flagsRef = useRef(flags);
  flagsRef.current = flags;

  const source = useMemo(
    () =>
      createAskableFeatureFlagSource({
        describe,
        kind,
        getFlags: () => {
          const f = flagsRef.current;
          return typeof f === 'function' ? f() : f;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  useEffect(() => {
    notifyRef.current();
  }, [flags]);

  return result;
}
