import { $ } from '@builder.io/qwik';
import type { QRL, SyncQRL } from '@builder.io/qwik';
import { createAskableUserSource } from '@askable-ui/core';
import type { AskableCreateUserSourceOptions, AskableUserProfile } from '@askable-ui/core';
export type { AskableUserProfile } from '@askable-ui/core';
import {
  useAskableSource,
  type AskableContextSourceFactory,
  type UseAskableSourceOptions,
  type UseAskableSourceResult,
} from './useAskableSource.js';

type UserDescription = Extract<
  NonNullable<AskableCreateUserSourceOptions['describe']>,
  (...args: never[]) => unknown
>;

export interface UseAskableUserSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateUserSourceOptions, 'describe' | 'getUser' | 'sanitize'> {
  id?: string;
  describe?: string | QRL<UserDescription>;
  getUser: QRL<() => AskableUserProfile | null | undefined | Promise<AskableUserProfile | null | undefined>>;
  sanitize?: SyncQRL<NonNullable<AskableCreateUserSourceOptions['sanitize']>>;
  /** Advanced resume-safe factory for custom identity integrations. */
  source$?: AskableContextSourceFactory;
}

export interface UseAskableUserSourceResult extends UseAskableSourceResult {}

/** Registers a user profile source with resume-safe data providers. */
export function useAskableUserSource(
  options: UseAskableUserSourceOptions,
): UseAskableUserSourceResult {
  const {
    id = 'user',
    enabled,
    ctx,
    ctx$,
    name,
    events,
    viewport,
    textExtractor,
    sanitizeMeta,
    sanitizeText,
    sanitizeSource,
    maxHistory,
    describe,
    getUser,
    sanitize,
    source$,
    ...sourceOptions
  } = options;

  const defaultSourceFactory = $(async () => {
    const [resolvedDescribe, resolvedGetUser, resolvedSanitize] = await Promise.all([
      typeof describe === 'string' ? describe : describe?.resolve(),
      getUser.resolve(),
      sanitize?.resolve(),
    ]);
    return createAskableUserSource({
      ...sourceOptions,
      describe: resolvedDescribe,
      getUser: resolvedGetUser,
      sanitize: resolvedSanitize,
    });
  });
  return useAskableSource(
    id,
    source$ ?? defaultSourceFactory,
    {
      enabled, ctx, ctx$, name, events, viewport, textExtractor,
      sanitizeMeta, sanitizeText, sanitizeSource, maxHistory,
    },
  );
}
