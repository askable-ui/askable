import { $, noSerialize, useSignal } from '@builder.io/qwik';
import type { NoSerialize, QRL, SyncQRL } from '@builder.io/qwik';
import { createAskableFormSource } from '@askable-ui/core';
import type { AskableCreateFormSourceOptions } from '@askable-ui/core';
import {
  useAskableSource,
  type AskableContextSourceFactory,
  type UseAskableSourceOptions,
  type UseAskableSourceResult,
} from './useAskableSource.js';

type FormDescription = Extract<
  NonNullable<AskableCreateFormSourceOptions['describe']>,
  (...args: never[]) => unknown
>;

export interface UseAskableFormSourceOptions
  extends UseAskableSourceOptions,
    Omit<
      AskableCreateFormSourceOptions,
      'form' | 'describe' | 'resolveLabel' | 'resolveValue' | 'sanitizeSnapshot'
    > {
  id?: string;
  /** Selectors and direct runtime forms remain supported; use `form$` for resume. */
  form?: AskableCreateFormSourceOptions['form'];
  form$?: QRL<() => HTMLFormElement | null | undefined>;
  describe?: string | QRL<FormDescription>;
  resolveLabel?: SyncQRL<NonNullable<AskableCreateFormSourceOptions['resolveLabel']>>;
  resolveValue?: SyncQRL<NonNullable<AskableCreateFormSourceOptions['resolveValue']>>;
  sanitizeSnapshot?: SyncQRL<NonNullable<AskableCreateFormSourceOptions['sanitizeSnapshot']>>;
  /** Advanced resume-safe factory for custom form integration. */
  source$?: AskableContextSourceFactory;
}

export interface UseAskableFormSourceResult extends UseAskableSourceResult {}

/** Registers a form source that can be reconstructed after SSR resume. */
export function useAskableFormSource(
  options: UseAskableFormSourceOptions = {},
): UseAskableFormSourceResult {
  const {
    id = 'form',
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
    form,
    form$,
    describe,
    resolveLabel,
    resolveValue,
    sanitizeSnapshot,
    source$,
    ...sourceOptions
  } = options;

  const formSelector = typeof form === 'string' ? form : undefined;
  const directForm = useSignal<NoSerialize<{
    value: HTMLFormElement | (() => HTMLFormElement | null | undefined);
  }>>(form && typeof form !== 'string' ? noSerialize({ value: form }) : undefined);
  const hasDirectForm = form !== undefined && typeof form !== 'string';

  const defaultSourceFactory = $(async () => {
    const resolvedForm = await form$?.() ?? directForm.value?.value ?? formSelector;
    if (hasDirectForm && !resolvedForm) {
      throw new Error(
        'Askable form was not available after Qwik resume; pass a selector or QRL form$ instead',
      );
    }
    const [resolvedDescribe, resolvedLabel, resolvedValue, resolvedSanitizeSnapshot] =
      await Promise.all([
        typeof describe === 'string' ? describe : describe?.resolve(),
        resolveLabel?.resolve(),
        resolveValue?.resolve(),
        sanitizeSnapshot?.resolve(),
      ]);
    return createAskableFormSource({
      ...sourceOptions,
      form: resolvedForm,
      describe: resolvedDescribe,
      resolveLabel: resolvedLabel,
      resolveValue: resolvedValue,
      sanitizeSnapshot: resolvedSanitizeSnapshot,
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
