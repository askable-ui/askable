import { createEffect } from 'solid-js';
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
   * Accessor returning the current user profile.
   * Return null to represent "not logged in".
   */
  user?: () => AskableUserProfile | null | undefined;
}

export type UseAskableUserSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that registers a user profile source so AI assistants can
 * personalise responses — addressing users by name, respecting their role
 * and plan, and adapting to their locale.
 *
 * ```tsx
 * const [user] = createSignal<AskableUserProfile | null>(null);
 * useAskableUserSource({ user });
 *
 * // With Clerk Solid SDK
 * const { user } = useUser();
 * useAskableUserSource({
 *   user: () => user() ? { name: user()!.fullName, role: user()!.publicMetadata.role } : null,
 * });
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
    getUser: () => user?.() ?? null,
  });

  const result = useAskableSource(id, userSource, { enabled, ctx, name, events });

  if (user) {
    createEffect(() => {
      user();
      result.notifyChanged();
    });
  }

  return result;
}
