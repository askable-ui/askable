import { createAskableUserSource } from '@askable-ui/core';
import type { AskableContext, AskableCreateUserSourceOptions, AskableUserProfile } from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableUserProfile };

export interface UseAskableUserSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateUserSourceOptions, 'getUser'> {
  /** Source registration id. Defaults to "user". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Getter returning the current user profile.
   * Return null to represent "not logged in".
   */
  user?: () => AskableUserProfile | null | undefined;
}

export type UseAskableUserSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that registers a user profile source so
 * AI assistants can personalise responses — addressing users by name,
 * respecting their role and plan, and adapting to their locale.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableUserSource } from '@askable-ui/svelte/useAskableUserSource.svelte';
 *
 *   let user = $state<AskableUserProfile | null>(null);
 *   useAskableUserSource({ user: () => user });
 * </script>
 * ```
 */
export function useAskableUserSource(
  options: UseAskableUserSourceOptions = {},
): UseAskableUserSource {
  const {
    id = 'user',
    ctx,
    user,
    describe,
    kind,
    omitFields,
    sanitize,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const userSource = createAskableUserSource({
    describe,
    kind,
    omitFields,
    sanitize,
    getUser: () => user?.() ?? null,
  });

  const result = useAskableSource(id, {
    ...userSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  $effect(() => {
    user?.();
    result.notifyChanged();
  });

  return result;
}
