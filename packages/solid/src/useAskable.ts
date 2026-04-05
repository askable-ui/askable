import { createSignal, createEffect, createMemo, onCleanup } from 'solid-js';
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
  /** Reactive accessor — call as focus() in JSX or reactive contexts */
  focus: () => AskableFocus | null;
  /** Reactive accessor — derived from focus, updates when focus changes */
  promptContext: () => string;
  ctx: AskableContext;
}

export function useAskable(options?: {
  events?: AskableEvent[];
  ctx?: AskableContext;
}): UseAskableResult {
  const usesProvidedCtx = Boolean(options?.ctx);
  const ctx = options?.ctx ?? getGlobalCtx();

  const [focus, setFocus] = createSignal<AskableFocus | null>(ctx.getFocus());

  const promptContext = createMemo(() => {
    focus(); // track the signal so memo updates when focus changes
    return ctx.toPromptContext();
  });

  createEffect(() => {
    if (!usesProvidedCtx) {
      refCount++;
      if (typeof document !== 'undefined') {
        ctx.observe(document, { events: options?.events });
      }
    }

    const handler = (f: AskableFocus) => setFocus(() => f);
    const clearHandler = (_: null) => setFocus(null);
    ctx.on('focus', handler);
    ctx.on('clear', clearHandler);

    onCleanup(() => {
      ctx.off('focus', handler);
      ctx.off('clear', clearHandler);
      if (!usesProvidedCtx) {
        refCount--;
        if (refCount === 0) {
          globalCtx?.destroy();
          globalCtx = null;
        }
      }
    });
  });

  return { focus, promptContext, ctx };
}
