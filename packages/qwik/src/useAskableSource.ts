import { useVisibleTask$ } from '@builder.io/qwik';
import type {
  AskableAsyncPromptContextOptions,
  AskableContext,
  AskableContextSource,
  AskableContextSourceHandle,
  AskableContextSourceRequest,
  AskableResolvedContextSource,
} from '@askable-ui/core';
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

/**
 * Qwik hook that registers an arbitrary context source on the shared
 * AskableContext. The source is registered once the component mounts in the
 * browser and unregistered on cleanup.
 */
export function useAskableSource(
  id: string,
  source: AskableContextSource,
  options: UseAskableSourceOptions = {},
): UseAskableSourceResult {
  const { enabled = true, ...askableOptions } = options;
  const { ctx: _ctxRef } = useAskable(askableOptions);

  let handle: AskableContextSourceHandle | null = null;

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const ctx = _ctxRef;
    if (!ctx || !enabled || !id.trim()) return;

    handle = ctx.registerSource(id.trim(), source);

    cleanup(() => {
      handle?.unregister();
      handle = null;
    });
  });

  return {
    get ctx() { return _ctxRef; },
    sourceId: id,
    resolve: (request?) => _ctxRef.resolveSource(id, request),
    toPromptContext: (opts?) => {
      const { source: sourceRequest, ...rest } = opts ?? {};
      return _ctxRef.toPromptContextAsync({
        ...rest,
        sources: [{ id, ...sourceRequest }],
      });
    },
    notifyChanged: () => handle?.notifyChanged(),
    unregister: () => { handle?.unregister(); handle = null; },
  };
}
