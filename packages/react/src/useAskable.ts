import { useState, useEffect, useRef } from 'react';
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
  focus: AskableFocus | null;
  promptContext: string;
  ctx: AskableContext;
}

export function useAskable(options?: {
  events?: AskableEvent[];
  ctx?: AskableContext;
}): UseAskableResult {
  const usesProvidedCtx = Boolean(options?.ctx);
  const ctx = useRef<AskableContext>(options?.ctx ?? getGlobalCtx());
  const [focus, setFocus] = useState<AskableFocus | null>(() => ctx.current.getFocus());

  useEffect(() => {
    const current = ctx.current;

    if (!usesProvidedCtx) {
      refCount++;
      if (typeof document !== 'undefined') {
        current.observe(document, { events: options?.events });
      }
    }

    const handler = (f: AskableFocus) => setFocus(f);
    const clearHandler = () => setFocus(null);
    current.on('focus', handler);
    current.on('clear', clearHandler);

    return () => {
      current.off('focus', handler);
      current.off('clear', clearHandler);
      if (!usesProvidedCtx) {
        refCount--;
        if (refCount === 0) {
          globalCtx?.destroy();
          globalCtx = null;
        }
      }
    };
  }, [options?.events, usesProvidedCtx]);

  return {
    focus,
    promptContext: ctx.current.toPromptContext(),
    ctx: ctx.current,
  };
}
