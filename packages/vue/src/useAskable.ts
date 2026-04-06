import { ref, computed, onMounted, onUnmounted } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContextOptions, AskableEvent, AskableFocus, AskableContext } from '@askable-ui/core';

let globalCtx: AskableContext | null = null;
let refCount = 0;

function getGlobalCtx(): AskableContext {
  // During SSR (no window), never persist to the module-level singleton —
  // each render gets a fresh throwaway context so requests don't share state.
  if (typeof window === 'undefined') {
    return createAskableContext();
  }
  if (!globalCtx) {
    globalCtx = createAskableContext();
  }
  return globalCtx;
}

export interface UseAskableOptions extends AskableContextOptions {
  events?: AskableEvent[];
  /**
   * Provide a pre-created context. When set, all `AskableContextOptions`
   * (maxHistory, sanitizeMeta, etc.) are ignored — configure those on the
   * context you pass in.
   */
  ctx?: AskableContext;
}

export interface UseAskableResult {
  focus: ReturnType<typeof ref<AskableFocus | null>>;
  promptContext: ReturnType<typeof computed<string>>;
  ctx: AskableContext;
}

function hasContextCreationOptions(options?: UseAskableOptions): boolean {
  return Boolean(
    options?.maxHistory !== undefined ||
    options?.sanitizeMeta ||
    options?.sanitizeText ||
    options?.textExtractor
  );
}

export function useAskable(options?: UseAskableOptions) {
  const usesProvidedCtx = Boolean(options?.ctx);
  // Use a private context when context-creation options are specified
  const usePrivateCtx = !usesProvidedCtx && hasContextCreationOptions(options);

  const ctx = options?.ctx ?? (usePrivateCtx ? createAskableContext(options) : getGlobalCtx());
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
  function clearHandler(_: null) {
    focus.value = null;
  }

  onMounted(() => {
    if (!usesProvidedCtx) {
      if (!usePrivateCtx) refCount++;
      if (typeof document !== 'undefined') {
        ctx.observe(document, { events: options?.events });
      }
    }
    ctx.on('focus', handler);
    ctx.on('clear', clearHandler);
  });

  onUnmounted(() => {
    ctx.off('focus', handler);
    ctx.off('clear', clearHandler);
    if (!usesProvidedCtx) {
      if (usePrivateCtx) {
        ctx.destroy();
      } else {
        refCount--;
        if (refCount === 0) {
          globalCtx?.destroy();
          globalCtx = null;
        }
      }
    }
  });

  return { focus, promptContext, ctx };
}
