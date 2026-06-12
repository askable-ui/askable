import { watch, type MaybeRef, toValue } from 'vue';
import { createAskableUserSource } from '@askable-ui/core';
import type { AskableCreateUserSourceOptions, AskableUserProfile } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableUserProfile };

export interface UseAskableUserSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateUserSourceOptions, 'getUser'> {
  /** Source registration id. Defaults to "user". */
  id?: string;
  /**
   * Current user profile. Accepts:
   * - `Ref<AskableUserProfile | null>` or plain value
   * - Reactive user objects from Clerk, Pinia auth stores, etc.
   */
  user?: MaybeRef<AskableUserProfile | null | undefined>;
  /** Accept reactive enabled ref from parent. */
  enabled?: MaybeRef<boolean>;
}

export type UseAskableUserSourceResult = UseAskableSourceResult;

/**
 * Vue composable that registers a user profile source so AI assistants can
 * personalise responses — addressing users by name, respecting their role
 * and plan, and adapting to their locale.
 *
 * ```ts
 * // Pinia auth store
 * const auth = useAuthStore();
 * useAskableUserSource({ user: computed(() => auth.user) });
 *
 * // Plain reactive user
 * const { user } = useCurrentUser(); // Clerk Vue SDK
 * useAskableUserSource({ user, omitFields: ['email'] });
 * ```
 */
export function useAskableUserSource(
  options: UseAskableUserSourceOptions = {},
): UseAskableUserSourceResult {
  const {
    id = 'user',
    user,
    describe,
    kind,
    omitFields,
    sanitize,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const userSource = createAskableUserSource({
    describe,
    kind,
    omitFields,
    sanitize,
    getUser: () => toValue(user) ?? null,
  });

  const result = useAskableSource(id, userSource, { enabled, ctx, name, events });

  if (user !== undefined) {
    watch(() => toValue(user), () => result.notifyChanged(), { deep: true });
  }

  return result;
}
