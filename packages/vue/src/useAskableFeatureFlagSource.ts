import { watch, type MaybeRef, toValue } from 'vue';
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
  /** Reactive flag map. Accepts a plain object, ref, or getter. */
  flags?: MaybeRef<Record<string, AskableFeatureFlagValue> | null | undefined>;
  enabled?: MaybeRef<boolean>;
}

export type UseAskableFeatureFlagSourceResult = UseAskableSourceResult;

/**
 * Vue composable that exposes feature flag state to AI assistants so they can
 * explain why features are or aren't available. Works with LaunchDarkly,
 * PostHog, GrowthBook, Statsig, Unleash, or any custom flag system.
 *
 * @example
 * ```ts
 * const flags = ref(ldClient.allFlags());
 * useAskableFeatureFlagSource({ flags });
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

  const source = createAskableFeatureFlagSource({
    describe,
    kind,
    getFlags: () => toValue(flags) ?? null,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  watch(
    () => toValue(flags),
    () => result.notifyChanged(),
    { deep: true },
  );

  return result;
}
