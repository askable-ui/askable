import { noSerialize, useSignal, useVisibleTask$ } from '@builder.io/qwik';
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

export interface UseAskableSourceOptions extends Omit<UseAskableOptions, never> {
  enabled?: boolean;
}

export interface UseAskableSourceResult {
  ctx: AskableContext;
  sourceId: string;
  resolve(request?: Omit<AskableContextSourceRequest, 'id'>): Promise<AskableResolvedContextSource>;
  toPromptContext(
    options?: Omit<AskableAsyncPromptContextOptions, 'sources'>
      & { source?: Omit<AskableContextSourceRequest, 'id'> },
  ): Promise<string>;
  notifyChanged(): void;
  unregister(): void;
}

export type AskableContextSourceFactory = QRL<
  () => AskableContextSource | Promise<AskableContextSource>
>;

/**
 * Qwik hook that registers an arbitrary context source on the shared
 * AskableContext. The source is registered once the component mounts in the
 * browser and unregistered on cleanup.
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

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup, track }) => {
    let disposed = false;
    cleanup(() => {
      disposed = true;
      handleRef.value?.unregister();
      handleRef.value = undefined;
    });

    const ctx = track(() => ctxRef.value);
    if (!ctx || !enabled || !id.trim()) return;

    let resolvedSource: AskableContextSource | undefined;
    try {
      resolvedSource = sourceFactory ? await sourceFactory() : clientSource;
    } catch (error) {
      if (disposed) return;
      throw error;
    }
    if (!resolvedSource) {
      throw new Error(
        'Askable source was not available after Qwik resume; pass a QRL source factory instead',
      );
    }
    if (disposed) return;
    handleRef.value = noSerialize(ctx.registerSource(id.trim(), resolvedSource));
  });

  return {
    get ctx() { return ctxRef.value!; },
    sourceId: id,
    resolve: (request?) => getAskableContext(ctxRef).resolveSource(id, request),
    toPromptContext: (opts?) => {
      const { source: sourceRequest, ...rest } = opts ?? {};
      return getAskableContext(ctxRef).toPromptContextAsync({
        ...rest,
        sources: [{ id, ...sourceRequest }],
      });
    },
    notifyChanged: () => handleRef.value?.notifyChanged(),
    unregister: () => {
      handleRef.value?.unregister();
      handleRef.value = undefined;
    },
  };
}
