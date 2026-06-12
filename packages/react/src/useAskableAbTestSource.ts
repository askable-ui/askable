import { useEffect, useMemo, useRef } from 'react';
import { createAskableAbTestSource } from '@askable-ui/core';
import type {
  AskableCreateAbTestSourceOptions,
  AskableAbTestVariant,
  AskableAbTestSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableAbTestVariant, AskableAbTestSourceSnapshot };

export interface UseAskableAbTestSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateAbTestSourceOptions, 'getExperiments'> {
  /** Source registration id. Defaults to "ab-tests". */
  id?: string;
  /**
   * Current A/B experiment assignments. Accepts an array or getter function.
   * Compatible with Optimizely, LaunchDarkly, PostHog experiments, Statsig,
   * GrowthBook, or any custom A/B system.
   */
  experiments?:
    | AskableAbTestVariant[]
    | null
    | undefined
    | (() => AskableAbTestVariant[] | null | undefined);
}

export type UseAskableAbTestSourceResult = UseAskableSourceResult;

/**
 * React hook that exposes A/B test variant assignments to AI assistants so
 * they can explain why the user sees a different UI, answer questions about
 * feature availability, and debug experiment-related issues.
 *
 * @example
 * ```tsx
 * // PostHog
 * const variant = useFeatureFlagVariantKey('checkout_flow');
 * useAskableAbTestSource({
 *   experiments: [{ experiment: 'checkout_flow', variant: variant ?? 'control', isControl: !variant || variant === 'control' }],
 * });
 * ```
 */
export function useAskableAbTestSource(
  options: UseAskableAbTestSourceOptions = {},
): UseAskableAbTestSourceResult {
  const {
    id = 'ab-tests',
    experiments,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const experimentsRef = useRef(experiments);
  experimentsRef.current = experiments;

  const source = useMemo(
    () =>
      createAskableAbTestSource({
        describe,
        kind,
        getExperiments: () => {
          const e = experimentsRef.current;
          return typeof e === 'function' ? e() : e;
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
  }, [experiments]);

  return result;
}
