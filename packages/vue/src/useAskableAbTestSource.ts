import { watch, type MaybeRef, toValue } from 'vue';
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
  /** Reactive A/B experiment assignments. Accepts an array, ref, or getter. */
  experiments?: MaybeRef<AskableAbTestVariant[] | null | undefined>;
  enabled?: MaybeRef<boolean>;
}

export type UseAskableAbTestSourceResult = UseAskableSourceResult;

/**
 * Vue composable that exposes A/B test variant assignments to AI assistants.
 *
 * @example
 * ```ts
 * const experiments = ref([{ experiment: 'checkout', variant: 'v2', isControl: false }]);
 * useAskableAbTestSource({ experiments });
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

  const source = createAskableAbTestSource({
    describe,
    kind,
    getExperiments: () => toValue(experiments) ?? null,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  watch(
    () => toValue(experiments),
    () => result.notifyChanged(),
    { deep: true },
  );

  return result;
}
