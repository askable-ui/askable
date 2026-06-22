import { createAskableUserSource } from '@askable-ui/core';
import type { AskableCreateUserSourceOptions, AskableUserProfile } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableUserProfile };

export interface UseAskableUserSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateUserSourceOptions {
  id?: string;
}

export type UseAskableUserSourceResult = UseAskableSourceResult;

/**
 * Registers a user source that exposes authenticated user identity
 * (name, email, roles, preferences) to the AI.
 *
 * ```tsx
 * // In your root component (after auth resolves):
 * useAskableUserSource({ getUser: () => session.value?.user ?? null });
 * ```
 */
export function useAskableUserSource(options: UseAskableUserSourceOptions): UseAskableUserSourceResult {
  const { id = 'user', enabled, ctx, name, events, ...sourceOptions } = options;
  const source = createAskableUserSource(sourceOptions);
  return useAskableSource(id, source, { enabled, ctx, name, events });
}
