import { useSignal, useVisibleTask$, useComputed$ } from '@builder.io/qwik';
import type { AskableContext, AskableFocus } from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export interface UseAskableHistoryOptions extends UseAskableOptions {
  maxEntries?: number;
  dedupe?: boolean;
}

export interface UseAskableHistoryResult {
  history: ReturnType<typeof useSignal<AskableFocus[]>>;
  current: ReturnType<typeof useSignal<AskableFocus | null>>;
  ctx: AskableContext;
}

/**
 * Qwik hook that maintains a history of recent focus events. Useful for
 * building AI chat that can reference what the user was looking at previously.
 *
 * ```tsx
 * export const AskHistory = component$(() => {
 *   const { history } = useAskableHistory({ maxEntries: 5 });
 *   return (
 *     <ul>
 *       {history.value.map((f, i) => (
 *         <li key={i}>{JSON.stringify(f.meta)}</li>
 *       ))}
 *     </ul>
 *   );
 * });
 * ```
 */
export function useAskableHistory(options?: UseAskableHistoryOptions): UseAskableHistoryResult {
  const maxEntries = options?.maxEntries ?? 10;
  const dedupe = options?.dedupe ?? true;

  const { ctx } = useAskable(options);
  const history = useSignal<AskableFocus[]>([]);
  const current = useSignal<AskableFocus | null>(null);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const handleFocus = (f: AskableFocus) => {
      current.value = f;
      const prev = history.value;
      if (dedupe && prev.length > 0 && JSON.stringify(prev[0].meta) === JSON.stringify(f.meta)) return;
      const next = [f, ...prev];
      history.value = next.length > maxEntries ? next.slice(0, maxEntries) : next;
    };
    const handleClear = (_: null) => { current.value = null; };

    ctx.on('focus', handleFocus);
    ctx.on('clear', handleClear);

    cleanup(() => {
      ctx.off('focus', handleFocus);
      ctx.off('clear', handleClear);
    });
  });

  return { history, current, ctx };
}
