import { useState, useEffect, useMemo } from 'react';
import type { AskableContext, AskableFocus } from '@askable-ui/core';
import { useAskable } from './useAskable.js';
import type { UseAskableOptions } from './useAskable.js';

export interface UseAskableHistoryOptions extends UseAskableOptions {
  /**
   * Maximum number of entries to keep.
   * @default 10
   */
  maxEntries?: number;
  /**
   * Deduplicate consecutive identical entries (same meta JSON).
   * When true, clicking the same element twice only keeps one entry.
   * @default true
   */
  dedupe?: boolean;
}

export interface UseAskableHistoryResult {
  /**
   * Ordered list of past focused elements, newest first.
   * Capped at `maxEntries`.
   */
  history: AskableFocus[];
  /**
   * Prompt-ready string describing the navigation trail.
   * Inject into your system prompt so the AI understands the user's journey.
   */
  promptContext: string;
  /** The current (most recent) focus, or null if the context was cleared. */
  current: AskableFocus | null;
  ctx: AskableContext;
}

export function useAskableHistory(options?: UseAskableHistoryOptions): UseAskableHistoryResult {
  const maxEntries = options?.maxEntries ?? 10;
  const dedupe = options?.dedupe ?? true;

  const { ctx } = useAskable(options);
  const [history, setHistory] = useState<AskableFocus[]>([]);
  const [current, setCurrent] = useState<AskableFocus | null>(null);

  useEffect(() => {
    const handleFocus = (f: AskableFocus) => {
      setCurrent(f);
      setHistory((prev) => {
        if (dedupe && prev.length > 0 && JSON.stringify(prev[0].meta) === JSON.stringify(f.meta)) {
          return prev;
        }
        const next = [f, ...prev];
        return next.length > maxEntries ? next.slice(0, maxEntries) : next;
      });
    };

    const handleClear = () => {
      setCurrent(null);
    };

    ctx.on('focus', handleFocus);
    ctx.on('clear', handleClear);

    return () => {
      ctx.off('focus', handleFocus);
      ctx.off('clear', handleClear);
    };
  }, [ctx, maxEntries, dedupe]);

  const promptContext = useMemo(() => {
    if (!history.length) return 'No navigation history yet.';
    const lines = history.map((item, i) => {
      const meta = typeof item.meta === 'string' ? item.meta : JSON.stringify(item.meta);
      const text = item.text ? ` ("${item.text.slice(0, 80)}")` : '';
      return `${i === 0 ? '→ ' : '  '}${meta}${text}`;
    });
    return `User navigation trail (most recent first):\n${lines.join('\n')}`;
  }, [history]);

  return { history, promptContext, current, ctx };
}
