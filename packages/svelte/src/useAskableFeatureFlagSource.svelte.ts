import { createAskableFeatureFlagSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateFeatureFlagSourceOptions,
  AskableFeatureFlagValue,
  AskableFeatureFlagSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableFeatureFlagValue, AskableFeatureFlagSourceSnapshot };

export interface UseAskableFeatureFlagSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateFeatureFlagSourceOptions, 'getFlags'> {
  /** Source registration id. Defaults to "feature-flags". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Current flag map. Pass a reactive getter (e.g. `() => flags`) so Svelte
   * runes can track changes automatically.
   */
  flags?:
    | Record<string, AskableFeatureFlagValue>
    | null
    | undefined
    | (() => Record<string, AskableFeatureFlagValue> | null | undefined);
}

export type UseAskableFeatureFlagSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that exposes feature flag state to AI
 * assistants so they can explain why features are or aren't available.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableFeatureFlagSource } from '@askable-ui/svelte/useAskableFeatureFlagSource.svelte';
 *   let flags = $state(ldClient.allFlags());
 *   useAskableFeatureFlagSource({ flags: () => flags });
 * </script>
 * ```
 */
export function useAskableFeatureFlagSource(
  options: UseAskableFeatureFlagSourceOptions = {},
): UseAskableFeatureFlagSource {
  const {
    id = 'feature-flags',
    flags,
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const flagSource = createAskableFeatureFlagSource({
    describe,
    kind,
    getFlags: () => {
      const f = flags;
      return typeof f === 'function' ? f() : f ?? null;
    },
  });

  const result = useAskableSource(id, {
    ...flagSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  $effect(() => {
    const f = flags;
    void (typeof f === 'function' ? f() : f);
    result.notifyChanged();
  });

  return result;
}
