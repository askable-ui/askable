import { $, noSerialize, useSignal } from '@builder.io/qwik';
import type { NoSerialize, QRL, SyncQRL } from '@builder.io/qwik';
import { createAskablePageSource } from '@askable-ui/core';
import type { AskableCreatePageSourceOptions } from '@askable-ui/core';
import {
  useAskableSource,
  type AskableContextSourceFactory,
  type UseAskableSourceOptions,
  type UseAskableSourceResult,
} from './useAskableSource.js';

type PageDescription = Extract<
  NonNullable<AskableCreatePageSourceOptions['describe']>,
  (...args: never[]) => unknown
>;

export interface UseAskablePageSourceOptions
  extends UseAskableSourceOptions,
    Omit<
      AskableCreatePageSourceOptions,
      'describe' | 'textExtractor' | 'sanitizeText'
    > {
  id?: string;
  /** Direct DOM roots remain supported for client-only mounts. */
  root?: Document | HTMLElement;
  /** Resolve a DOM root after browser resume. Defaults to the global document. */
  root$?: QRL<() => Document | HTMLElement | undefined>;
  describe?: string | QRL<PageDescription>;
  textExtractor?: SyncQRL<NonNullable<AskableCreatePageSourceOptions['textExtractor']>>;
  sanitizeText?: SyncQRL<NonNullable<AskableCreatePageSourceOptions['sanitizeText']>>;
  /** Advanced resume-safe factory for custom page integrations. */
  source$?: AskableContextSourceFactory;
}

export interface UseAskablePageSourceResult extends UseAskableSourceResult {}

/**
 * Registers a page source that snapshots page text, selection, headings, and
 * optional links. DOM roots and callbacks use QRLs so the source can be
 * reconstructed after SSR resume.
 */
export function useAskablePageSource(
  options: UseAskablePageSourceOptions = {},
): UseAskablePageSourceResult {
  const {
    id = 'page',
    enabled,
    ctx,
    ctx$,
    name,
    events,
    viewport,
    sanitizeMeta,
    sanitizeSource,
    maxHistory,
    root,
    root$,
    describe,
    textExtractor,
    sanitizeText,
    source$,
    ...sourceOptions
  } = options;

  const directRoot = useSignal<NoSerialize<{ value: Document | HTMLElement }>>(
    root ? noSerialize({ value: root }) : undefined,
  );
  const hasDirectRoot = root !== undefined;

  const sourceFactory = $(async () => {
    const resolvedRoot = await root$?.() ?? directRoot.value?.value;
    if (hasDirectRoot && !resolvedRoot) {
      throw new Error(
        'Askable page root was not available after Qwik resume; pass a QRL root$ instead',
      );
    }
    const [resolvedDescribe, resolvedTextExtractor, resolvedSanitizeText] = await Promise.all([
      typeof describe === 'string' ? describe : describe?.resolve(),
      textExtractor?.resolve(),
      sanitizeText?.resolve(),
    ]);
    return createAskablePageSource({
      ...sourceOptions,
      root: resolvedRoot,
      describe: resolvedDescribe,
      textExtractor: resolvedTextExtractor,
      sanitizeText: resolvedSanitizeText,
    });
  });
  return useAskableSource(
    id,
    source$ ?? sourceFactory,
    {
      enabled, ctx, ctx$, name, events, viewport,
      sanitizeMeta, sanitizeSource, maxHistory,
    },
  );
}
