import { ref, computed, onMounted, onUnmounted } from 'vue';
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
   * @default true
   */
  dedupe?: boolean;
}

export interface UseAskableHistoryResult {
  history: ReturnType<typeof ref<AskableFocus[]>>;
  current: ReturnType<typeof ref<AskableFocus | null>>;
  promptContext: ReturnType<typeof computed<string>>;
  ctx: AskableContext;
}

export function useAskableHistory(options?: UseAskableHistoryOptions) {
  const maxEntries = options?.maxEntries ?? 10;
  const dedupe = options?.dedupe ?? true;

  const { ctx } = useAskable(options);
  const history = ref<AskableFocus[]>([]);
  const current = ref<AskableFocus | null>(null);

  const promptContext = computed(() => {
    const items = history.value;
    if (!items.length) return 'No navigation history yet.';
    const lines = items.map((item, i) => {
      const meta = typeof item.meta === 'string' ? item.meta : JSON.stringify(item.meta);
      const text = item.text ? ` ("${item.text.slice(0, 80)}")` : '';
      return `${i === 0 ? '→ ' : '  '}${meta}${text}`;
    });
    return `User navigation trail (most recent first):\n${lines.join('\n')}`;
  });

  function handleFocus(f: AskableFocus) {
    current.value = f;
    if (dedupe && history.value.length > 0 && JSON.stringify(history.value[0].meta) === JSON.stringify(f.meta)) {
      return;
    }
    const next = [f, ...history.value];
    history.value = next.length > maxEntries ? next.slice(0, maxEntries) : next;
  }

  function handleClear() {
    current.value = null;
  }

  onMounted(() => {
    ctx.on('focus', handleFocus);
    ctx.on('clear', handleClear);
  });

  onUnmounted(() => {
    ctx.off('focus', handleFocus);
    ctx.off('clear', handleClear);
  });

  return { history, current, promptContext, ctx };
}
