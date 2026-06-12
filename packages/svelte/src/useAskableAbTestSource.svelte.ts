import { createAskableAbTestSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateAbTestSourceOptions,
  AskableAbTestVariant,
  AskableAbTestSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableAbTestVariant, AskableAbTestSourceSnapshot };

export interface UseAskableAbTestSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateAbTestSourceOptions, 'getExperiments'> {
  /** Source registration id. Defaults to "ab-tests". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Current A/B experiment assignments. Pass a reactive getter so Svelte runes
   * can track changes automatically.
   */
  experiments?:
    | AskableAbTestVariant[]
    | null
    | undefined
    | (() => AskableAbTestVariant[] | null | undefined);
}

export type UseAskableAbTestSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that exposes A/B test variant assignments to
 * AI assistants so they can explain why the user sees a different UI.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableAbTestSource } from '@askable-ui/svelte/useAskableAbTestSource.svelte';
 *   let experiments = $state([{ experiment: 'checkout', variant: 'v2', isControl: false }]);
 *   useAskableAbTestSource({ experiments: () => experiments });
 * </script>
 * ```
 */
export function useAskableAbTestSource(
  options: UseAskableAbTestSourceOptions = {},
): UseAskableAbTestSource {
  const {
    id = 'ab-tests',
    experiments,
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const abTestSource = createAskableAbTestSource({
    describe,
    kind,
    getExperiments: () => {
      const e = experiments;
      return typeof e === 'function' ? e() : e ?? null;
    },
  });

  const result = useAskableSource(id, {
    ...abTestSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  $effect(() => {
    const e = experiments;
    void (typeof e === 'function' ? e() : e);
    result.notifyChanged();
  });

  return result;
}
