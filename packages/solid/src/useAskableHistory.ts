import { createSignal, createEffect, onCleanup, createMemo } from 'solid-js';
import type { AskableContext, AskableFocus } from '@askable-ui/core';
import { useAskable } from './useAskable.js';
import type { UseAskableOptions } from './useAskable.js';

export interface UseAskableHistoryOptions extends UseAskableOptions {
  maxEntries?: number;
  dedupe?: boolean;
}

export interface UseAskableHistoryResult {
  history: () => AskableFocus[];
  current: () => AskableFocus | null;
  promptContext: () => string;
  ctx: AskableContext;
}

export function useAskableHistory(options?: UseAskableHistoryOptions): UseAskableHistoryResult {
  const maxEntries = options?.maxEntries ?? 10;
  const dedupe = options?.dedupe ?? true;

  const { ctx } = useAskable(options);
  const [history, setHistory] = createSignal<AskableFocus[]>([]);
  const [current, setCurrent] = createSignal<AskableFocus | null>(null);

  createEffect(() => {
    const handleFocus = (f: AskableFocus) => {
      setCurrent(() => f);
      setHistory((prev) => {
        if (dedupe && prev.length > 0 && JSON.stringify(prev[0].meta) === JSON.stringify(f.meta)) return prev;
        const next = [f, ...prev];
        return next.length > maxEntries ? next.slice(0, maxEntries) : next;
      });
    };
    const handleClear = () => setCurrent(null);

    ctx.on('focus', handleFocus);
    ctx.on('clear', handleClear);

    onCleanup(() => {
      ctx.off('focus', handleFocus);
      ctx.off('clear', handleClear);
    });
  });

  const promptContext = createMemo(() => {
    const items = history();
    if (!items.length) return 'No navigation history yet.';
    const lines = items.map((item, i) => {
      const meta = typeof item.meta === 'string' ? item.meta : JSON.stringify(item.meta);
      const text = item.text ? ` ("${item.text.slice(0, 80)}")` : '';
      return `${i === 0 ? '→ ' : '  '}${meta}${text}`;
    });
    return `User navigation trail (most recent first):\n${lines.join('\n')}`;
  });

  return { history, current, promptContext, ctx };
}
