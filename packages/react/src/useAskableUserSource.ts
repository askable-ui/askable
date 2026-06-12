import { useEffect, useMemo, useRef } from 'react';
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
   * - `AskableUserProfile | null` — from your auth context
   * - `() => AskableUserProfile | null` — lazy accessor
   * - `undefined` to represent "not logged in"
   */
  user?:
    | AskableUserProfile
    | null
    | undefined
    | (() => AskableUserProfile | null | undefined | Promise<AskableUserProfile | null | undefined>);
}

export type UseAskableUserSourceResult = UseAskableSourceResult;

/**
 * Hook that registers a user profile source so AI assistants can personalise
 * responses — addressing users by name, respecting their role and plan, and
 * adapting to their locale.
 *
 * Drop in any user object your auth library returns (Clerk, NextAuth, Supabase,
 * Firebase, Auth0, custom JWT, etc.) — it just needs name/email/role fields.
 *
 * ```tsx
 * // NextAuth
 * const { data: session } = useSession();
 * useAskableUserSource({ user: session?.user });
 *
 * // Clerk
 * const { user } = useUser();
 * useAskableUserSource({
 *   user: user ? { name: user.fullName, email: user.primaryEmailAddress?.emailAddress, role: user.publicMetadata.role } : null,
 * });
 *
 * // Custom auth context
 * useAskableUserSource({ user: currentUser, omitFields: ['email'] });
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

  const userRef = useRef(user);
  userRef.current = user;

  const userSource = useMemo(
    () =>
      createAskableUserSource({
        describe,
        kind,
        omitFields,
        sanitize,
        getUser: () => {
          const u = userRef.current;
          return typeof u === 'function' ? u() : u;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, omitFields?.join(',')],
  );

  const result = useAskableSource(id, userSource, { enabled, ctx, name, events });

  const notifyChangedRef = useRef(result.notifyChanged);
  notifyChangedRef.current = result.notifyChanged;

  useEffect(() => {
    notifyChangedRef.current();
  }, [user]);

  return result;
}
