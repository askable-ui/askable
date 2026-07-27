import { $ } from '@builder.io/qwik';
import type { SyncQRL } from '@builder.io/qwik';
import { createAskableNavigationSource } from '@askable-ui/core';
import type { AskableCreateNavigationSourceOptions } from '@askable-ui/core';
export type { AskableNavigationEntry } from '@askable-ui/core';
import {
  useAskableSource,
  type AskableContextSourceFactory,
  type UseAskableSourceOptions,
  type UseAskableSourceResult,
} from './useAskableSource.js';

export interface UseAskableNavigationSourceOptions
  extends UseAskableSourceOptions,
    Omit<
      AskableCreateNavigationSourceOptions,
      'getPath' | 'getTitle' | 'getParams' | 'describe'
    > {
  id?: string;
  getPath?: SyncQRL<NonNullable<AskableCreateNavigationSourceOptions['getPath']>>;
  getTitle?: SyncQRL<NonNullable<AskableCreateNavigationSourceOptions['getTitle']>>;
  getParams?: SyncQRL<NonNullable<AskableCreateNavigationSourceOptions['getParams']>>;
  describe?: SyncQRL<NonNullable<AskableCreateNavigationSourceOptions['describe']>>;
  /** Advanced resume-safe factory for router state that cannot use `sync$`. */
  source$?: AskableContextSourceFactory;
}

export interface UseAskableNavigationSourceResult extends UseAskableSourceResult {}

/** Registers a navigation source with resume-safe callbacks and history. */
export function useAskableNavigationSource(
  options: UseAskableNavigationSourceOptions = {},
): UseAskableNavigationSourceResult {
  const {
    id = 'navigation',
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
    getPath,
    getTitle,
    getParams,
    describe,
    source$,
    ...sourceOptions
  } = options;

  const defaultSourceFactory = $(async () => {
    const [resolvedPath, resolvedTitle, resolvedParams, resolvedDescribe] = await Promise.all([
      getPath?.resolve(),
      getTitle?.resolve(),
      getParams?.resolve(),
      describe?.resolve(),
    ]);
    return createAskableNavigationSource({
      ...sourceOptions,
      getPath: resolvedPath,
      getTitle: resolvedTitle,
      getParams: resolvedParams,
      describe: resolvedDescribe,
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
