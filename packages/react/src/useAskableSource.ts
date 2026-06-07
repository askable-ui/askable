import { useCallback, useEffect, useRef } from 'react';
import type {
  AskableAsyncPromptContextOptions,
  AskableContext,
  AskableContextSource,
  AskableContextSourceHandle,
  AskableContextSourceRequest,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export interface UseAskableSourceOptions extends Omit<UseAskableOptions, 'inspector'> {
  /** Register the source while true. Defaults to true. */
  enabled?: boolean;
}

export interface UseAskableSourceResult {
  ctx: AskableContext;
  sourceId: string;
  resolve: (request?: Omit<AskableContextSourceRequest, 'id'>) => Promise<AskableResolvedContextSource>;
  toPromptContext: (
    options?: Omit<AskableAsyncPromptContextOptions, 'sources'>
      & { source?: Omit<AskableContextSourceRequest, 'id'> },
  ) => Promise<string>;
  notifyChanged: () => void;
  unregister: () => void;
}

export function useAskableSource(
  id: string,
  source: AskableContextSource,
  options: UseAskableSourceOptions = {},
): UseAskableSourceResult {
  const { enabled = true, ...askableOptions } = options;
  const { ctx } = useAskable(askableOptions);
  const sourceRef = useRef(source);
  const handleRef = useRef<AskableContextSourceHandle | null>(null);
  sourceRef.current = source;

  const sourceId = id.trim();

  useEffect(() => {
    if (!enabled || !sourceId) return undefined;

    const proxy: AskableContextSource = {
      get kind() {
        return sourceRef.current.kind;
      },
      get modes() {
        return sourceRef.current.modes;
      },
      describe: () => {
        const describe = sourceRef.current.describe;
        if (typeof describe === 'function') return describe();
        return describe ?? '';
      },
      getState: () => sourceRef.current.getState?.(),
      resolve: (request) => sourceRef.current.resolve?.(request),
      sanitize: (resolved) => sourceRef.current.sanitize?.(resolved) ?? resolved,
    };

    const handle = ctx.registerSource(sourceId, proxy);
    handleRef.current = handle;

    return () => {
      handle.unregister();
      if (handleRef.current === handle) handleRef.current = null;
    };
  }, [ctx, enabled, sourceId]);

  const resolve = useCallback(
    (request?: Omit<AskableContextSourceRequest, 'id'>) => ctx.resolveSource(sourceId, request),
    [ctx, sourceId],
  );

  const toPromptContext = useCallback(
    (promptOptions?: Omit<AskableAsyncPromptContextOptions, 'sources'>
      & { source?: Omit<AskableContextSourceRequest, 'id'> }) => {
      const { source: sourceRequest, ...rest } = promptOptions ?? {};
      return ctx.toPromptContextAsync({
        ...rest,
        sources: [{ id: sourceId, ...sourceRequest }],
      });
    },
    [ctx, sourceId],
  );

  const notifyChanged = useCallback(() => {
    handleRef.current?.notifyChanged();
  }, []);

  const unregister = useCallback(() => {
    handleRef.current?.unregister();
    handleRef.current = null;
  }, []);

  return {
    ctx,
    sourceId,
    resolve,
    toPromptContext,
    notifyChanged,
    unregister,
  };
}
