import { ref, computed, onMounted, onUnmounted } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import type { AskableEvent, AskableFocus, AskableContext } from '@askable-ui/core';

let globalCtx: AskableContext | null = null;
let refCount = 0;

function getGlobalCtx(events?: AskableEvent[]): AskableContext {
  if (!globalCtx) {
    globalCtx = createAskableContext();
    globalCtx.observe(document, { events });
  }
  return globalCtx;
}

export interface UseAskableResult {
  focus: ReturnType<typeof ref<AskableFocus | null>>;
  promptContext: ReturnType<typeof computed<string>>;
  ctx: AskableContext;
}

export function useAskable(options?: { events?: AskableEvent[] }) {
  const ctx = getGlobalCtx(options?.events);
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

  onMounted(() => {
    refCount++;
    ctx.on('focus', handler);
  });

  onUnmounted(() => {
    ctx.off('focus', handler);
    refCount--;
    if (refCount === 0) {
      globalCtx?.destroy();
      globalCtx = null;
    }
  });

  return { focus, promptContext, ctx };
}
