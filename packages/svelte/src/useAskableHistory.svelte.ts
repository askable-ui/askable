import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextOptions, AskableFocus, AskableObserveOptions } from '@askable-ui/core';

export interface UseAskableHistoryOptions extends AskableContextOptions {
  observe?: boolean | AskableObserveOptions;
  ctx?: AskableContext;
  maxEntries?: number;
  dedupe?: boolean;
}

/**
 * Svelte 5 runes-based navigation history composable.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableHistory } from '@askable-ui/svelte/useAskableHistory.svelte';
 *   const hist = useAskableHistory({ observe: true });
 * </script>
 *
 * <p>{hist.promptContext}</p>
 * ```
 */
export function useAskableHistory(options?: UseAskableHistoryOptions) {
  const maxEntries = options?.maxEntries ?? 10;
  const dedupe = options?.dedupe ?? true;
  const usesProvidedCtx = Boolean(options?.ctx);
  const ctx = options?.ctx ?? createAskableContext(options);

  if (!usesProvidedCtx && typeof document !== 'undefined' && options?.observe !== false) {
    const observeOpts = typeof options?.observe === 'object' ? options.observe : undefined;
    ctx.observe(document, observeOpts);
  }

  let history: AskableFocus[] = $state([]);
  let current: AskableFocus | null = $state(null);

  const promptContext = $derived(
    history.length === 0
      ? 'No navigation history yet.'
      : `User navigation trail (most recent first):\n${history
          .map((item, i) => {
            const meta = typeof item.meta === 'string' ? item.meta : JSON.stringify(item.meta);
            const text = item.text ? ` ("${item.text.slice(0, 80)}")` : '';
            return `${i === 0 ? '→ ' : '  '}${meta}${text}`;
          })
          .join('\n')}`,
  );

  $effect(() => {
    const handleFocus = (f: AskableFocus) => {
      current = f;
      if (dedupe && history.length > 0 && JSON.stringify(history[0].meta) === JSON.stringify(f.meta)) return;
      const next = [f, ...history];
      history = next.length > maxEntries ? next.slice(0, maxEntries) : next;
    };
    const handleClear = () => { current = null; };

    ctx.on('focus', handleFocus);
    ctx.on('clear', handleClear);

    return () => {
      ctx.off('focus', handleFocus);
      ctx.off('clear', handleClear);
      if (!usesProvidedCtx) ctx.destroy();
    };
  });

  return {
    get history() { return history; },
    get current() { return current; },
    get promptContext() { return promptContext; },
    ctx,
  };
}
