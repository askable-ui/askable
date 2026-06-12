import { createEffect } from 'solid-js';
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
   * Current A/B experiment assignments. Accepts an array or reactive accessor
   * (signal) for automatic updates.
   */
  experiments?:
    | AskableAbTestVariant[]
    | null
    | undefined
    | (() => AskableAbTestVariant[] | null | undefined);
}

export type UseAskableAbTestSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that exposes A/B test variant assignments to AI assistants.
 *
 * @example
 * ```tsx
 * const [experiments] = createSignal([{ experiment: 'checkout', variant: 'v2', isControl: false }]);
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
    getExperiments: () => {
      const e = experiments;
      return typeof e === 'function' ? e() : e ?? null;
    },
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  createEffect(() => {
    const e = experiments;
    void (typeof e === 'function' ? e() : e);
    result.notifyChanged();
  });

  return result;
}
