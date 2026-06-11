import { createAskableContext } from '@askable-ui/core';
import type {
  AskableAsyncPromptContextOptions,
  AskableContext,
  AskableContextOptions,
  AskableContextSource,
  AskableContextSourceHandle,
  AskableContextSourceRequest,
  AskableObserveOptions,
  AskableResolvedContextSource,
} from '@askable-ui/core';

export interface UseAskableSourceOptions extends AskableContextOptions {
  observe?: boolean | AskableObserveOptions;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Register the source while true. Defaults to true. */
  enabled?: boolean;
}

export interface UseAskableSource {
  readonly ctx: AskableContext;
  readonly sourceId: string;
  resolve(request?: Omit<AskableContextSourceRequest, 'id'>): Promise<AskableResolvedContextSource>;
  toPromptContext(
    options?: Omit<AskableAsyncPromptContextOptions, 'sources'>
      & { source?: Omit<AskableContextSourceRequest, 'id'> },
  ): Promise<string>;
  notifyChanged(): void;
  unregister(): void;
}

/**
 * Svelte 5 runes-based composable to register an app-owned context source.
 *
 * Sources let you inject off-DOM data (user profile, store state, API results)
 * into the AI context without annotating every element.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskable } from '@askable-ui/svelte/useAskable.svelte';
 *   import { useAskableSource } from '@askable-ui/svelte/useAskableSource.svelte';
 *
 *   const { ctx } = useAskable({ observe: true });
 *   const { toPromptContext } = useAskableSource('user', {
 *     ctx,
 *     kind: 'data',
 *     describe: () => 'Current user profile',
 *     resolve: async () => ({ name: 'Alice', role: 'admin' }),
 *   });
 * </script>
 * ```
 */
export function useAskableSource(
  id: string,
  source: AskableContextSource & UseAskableSourceOptions,
): UseAskableSource {
  const { ctx: providedCtx, observe, enabled = true, ...sourceOptions } = source;
  const ctx = providedCtx ?? createAskableContext(sourceOptions);
  const sourceId = id.trim();
  let handle: AskableContextSourceHandle | null = null;

  if (!providedCtx && typeof document !== 'undefined' && observe !== false) {
    ctx.observe(document, observe === true || observe === undefined ? undefined : observe);
  }

  $effect(() => {
    if (!enabled || !sourceId) return;
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
    handle = ctx.registerSource(sourceId, proxy);
    return () => {
      handle?.unregister();
      handle = null;
    };
  });

  return {
    ctx,
    sourceId,
    resolve: (request?) => ctx.resolveSource(sourceId, request),
    toPromptContext: (opts?) => {
      const { source: srcReq, ...rest } = opts ?? {};
      return ctx.toPromptContextAsync({ ...rest, sources: [{ id: sourceId, ...srcReq }] });
    },
    notifyChanged: () => handle?.notifyChanged(),
    unregister: () => { handle?.unregister(); handle = null; },
  };
}
