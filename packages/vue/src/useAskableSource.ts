import { onUnmounted, watch, type MaybeRef, toRef } from 'vue';
import type {
  AskableAsyncPromptContextOptions,
  AskableContext,
  AskableContextSource,
  AskableContextSourceRequest,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export interface UseAskableSourceOptions extends Omit<UseAskableOptions, 'inspector'> {
  /** Register the source while true. Accepts a reactive ref. Defaults to true. */
  enabled?: MaybeRef<boolean>;
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
  const { enabled: enabledInput = true, ...askableOptions } = options;
  const { ctx } = useAskable(askableOptions);
  const sourceId = id.trim();
  let registered = false;
  let handle: ReturnType<AskableContext['registerSource']> | null = null;

  const enabledRef = toRef(enabledInput as MaybeRef<boolean>);

  function buildProxy(): AskableContextSource {
    return {
      get kind() {
        return source.kind;
      },
      get modes() {
        return source.modes;
      },
      describe: () => {
        const describe = source.describe;
        if (typeof describe === 'function') return describe();
        return describe ?? '';
      },
      getState: () => source.getState?.(),
      resolve: (request) => source.resolve?.(request),
      sanitize: (resolved) => source.sanitize?.(resolved) ?? resolved,
    };
  }

  function unregister() {
    if (!registered) return;
    handle?.unregister();
    handle = null;
    registered = false;
  }

  watch(enabledRef, (enabled) => {
    if (enabled && sourceId && !registered) {
      handle = ctx.registerSource(sourceId, buildProxy());
      registered = true;
    } else if (!enabled) {
      unregister();
    }
  }, { immediate: true });

  function notifyChanged() {
    handle?.notifyChanged();
  }

  onUnmounted(unregister);

  return {
    ctx,
    sourceId,
    resolve: (request?: Omit<AskableContextSourceRequest, 'id'>) => ctx.resolveSource(sourceId, request),
    toPromptContext: (promptOptions?: Omit<AskableAsyncPromptContextOptions, 'sources'>
      & { source?: Omit<AskableContextSourceRequest, 'id'> }) => {
      const { source: sourceRequest, ...rest } = promptOptions ?? {};
      return ctx.toPromptContextAsync({
        ...rest,
        sources: [{ id: sourceId, ...sourceRequest }],
      });
    },
    notifyChanged,
    unregister,
  };
}
