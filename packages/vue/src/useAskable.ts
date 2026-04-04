import { ref, computed, onMounted, onUnmounted } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import type { AskableEvent, AskableFocus, AskableContext } from '@askable-ui/core';

let globalCtx: AskableContext | null = null;
let refCount = 0;

function getGlobalCtx(): AskableContext {
  if (!globalCtx) {
    globalCtx = createAskableContext();
  }
  return globalCtx;
}

export interface UseAskableResult {
  focus: ReturnType<typeof ref<AskableFocus | null>>;
  promptContext: ReturnType<typeof computed<string>>;
  ctx: AskableContext;
}

export function useAskable(options?: { events?: AskableEvent[] }) {
  const ctx = getGlobalCtx();
  const focus = ref<AskableFocus | null>(ctx.getFocus());
  // Reference focus.value so Vue tracks it as a reactive dependency;
  // ctx.toPromptContext() is a plain method and not itself reactive.
  const promptContext = computed(() => {
    void focus.value;
    return ctx.toPromptContext();
  });

  function handler(f: AskableFocus) {
    focus.value = f;
  }
  function clearHandler() {
    focus.value = null;
  }

  onMounted(() => {
    refCount++;
    if (typeof document !== 'undefined') {
      ctx.observe(document, { events: options?.events });
    }
    ctx.on('focus', handler);
    ctx.on('clear', clearHandler);
  });

  onUnmounted(() => {
    ctx.off('focus', handler);
    ctx.off('clear', clearHandler);
    refCount--;
    if (refCount === 0) {
      globalCtx?.destroy();
      globalCtx = null;
    }
  });

  return { focus, promptContext, ctx };
}
