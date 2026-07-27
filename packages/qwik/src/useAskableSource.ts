import { $, noSerialize, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import type { NoSerialize, QRL } from '@builder.io/qwik';
import type {
  AskableAsyncPromptContextOptions,
  AskableContext,
  AskableContextSource,
  AskableContextSourceHandle,
  AskableContextSourceRequest,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { getAskableContext } from './contextRef.js';
import { useAskable, type UseAskableOptions } from './useAskable.js';
import type { AskableContextRef } from './contextRef.js';

export interface UseAskableSourceOptions extends Omit<UseAskableOptions, never> {
  enabled?: boolean;
}

export interface UseAskableSourceResult {
  /** Stable resumable reference populated when the browser lifecycle mounts. */
  ctxRef: AskableContextRef;
  ctx: AskableContext;
  sourceId: string;
  resolve: QRL<(request?: Omit<AskableContextSourceRequest, 'id'>) => Promise<AskableResolvedContextSource>>;
  toPromptContext: QRL<(
    options?: Omit<AskableAsyncPromptContextOptions, 'sources'>
      & { source?: Omit<AskableContextSourceRequest, 'id'> },
  ) => Promise<string>>;
  notifyChanged: QRL<() => void>;
  unregister: QRL<() => void>;
}

export type AskableContextSourceFactory = QRL<
  () => AskableContextSource | Promise<AskableContextSource>
>;

/**
 * Qwik hook that registers an arbitrary context source on the shared
 * AskableContext. The source is registered once the component mounts in the
 * browser and unregistered on cleanup. Pass a QRL factory for a source that
 * must be reconstructed after SSR resume; the direct object form is retained
 * for client-only compatibility.
 */
export function useAskableSource(
  id: string,
  source: AskableContextSource | AskableContextSourceFactory,
  options: UseAskableSourceOptions = {},
): UseAskableSourceResult {
  const { enabled = true, ...askableOptions } = options;
  const { ctxRef } = useAskable(askableOptions);
  const sourceFactory = typeof source === 'function' ? source : undefined;
  const clientSource = typeof source === 'function' ? undefined : noSerialize(source);

  const handleRef = useSignal<NoSerialize<AskableContextSourceHandle>>();
  const generationRef = useSignal(0);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup, track }) => {
    const generation = ++generationRef.value;
    let disposed = false;
    let taskHandle: AskableContextSourceHandle | undefined;
    cleanup(() => {
      disposed = true;
      if (generationRef.value === generation) generationRef.value++;
      if (handleRef.value === taskHandle) {
        handleRef.value = undefined;
        taskHandle?.unregister();
      }
    });

    const ctx = track(() => ctxRef.value);
    if (!ctx || !enabled || !id.trim()) return;

    let resolvedSource: AskableContextSource | undefined;
    try {
      resolvedSource = sourceFactory ? await sourceFactory() : clientSource;
    } catch (error) {
      if (disposed || generationRef.value !== generation) return;
      throw error;
    }
    if (disposed || generationRef.value !== generation) return;
    if (!resolvedSource) {
      throw new Error(
        'Askable source was not available after Qwik resume; pass a QRL source factory instead',
      );
    }
    taskHandle = ctx.registerSource(id.trim(), resolvedSource);
    handleRef.value = noSerialize(taskHandle);
  });

  const resolve = $((request?: Omit<AskableContextSourceRequest, 'id'>) =>
    getAskableContext(ctxRef).resolveSource(id, request));
  const toPromptContext = $((opts?: Omit<AskableAsyncPromptContextOptions, 'sources'>
    & { source?: Omit<AskableContextSourceRequest, 'id'> }) => {
    const { source: sourceRequest, ...rest } = opts ?? {};
    return getAskableContext(ctxRef).toPromptContextAsync({
      ...rest,
      sources: [{ id, ...sourceRequest }],
    });
  });
  const notifyChanged = $(() => handleRef.value?.notifyChanged());
  const unregister = $(() => {
    generationRef.value++;
    const handle = handleRef.value;
    handleRef.value = undefined;
    handle?.unregister();
  });

  return {
    ctxRef,
    get ctx() { return ctxRef.value!; },
    sourceId: id,
    resolve,
    toPromptContext,
    notifyChanged,
    unregister,
  };
}
