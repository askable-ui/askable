import { createEffect, onCleanup } from 'solid-js';
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
  const sourceId = id.trim();
  let handle: AskableContextSourceHandle | null = null;

  const proxy: AskableContextSource = {
    get kind() { return source.kind; },
    get modes() { return source.modes; },
    describe: () => {
      const d = source.describe;
      return typeof d === 'function' ? d() : (d ?? '');
    },
    getState: () => source.getState?.(),
    resolve: (request) => source.resolve?.(request),
    sanitize: (resolved) => source.sanitize?.(resolved) ?? resolved,
  };

  // Register immediately (synchronous) so source is available right away
  if (enabled && sourceId) {
    handle = ctx.registerSource(sourceId, proxy);
    onCleanup(() => { handle?.unregister(); handle = null; });
  }

  // Watch for reactive enabled changes after the initial registration
  createEffect(() => {
    if (enabled && sourceId && !handle) {
      handle = ctx.registerSource(sourceId, proxy);
      onCleanup(() => { handle?.unregister(); handle = null; });
    } else if (!enabled && handle) {
      handle.unregister();
      handle = null;
    }
  });

  return {
    ctx,
    sourceId,
    resolve: (request?) => ctx.resolveSource(sourceId, request),
    toPromptContext: (promptOptions?) => {
      const { source: sourceRequest, ...rest } = promptOptions ?? {};
      return ctx.toPromptContextAsync({
        ...rest,
        sources: [{ id: sourceId, ...sourceRequest }],
      });
    },
    notifyChanged: () => handle?.notifyChanged(),
    unregister: () => { handle?.unregister(); handle = null; },
  };
}
