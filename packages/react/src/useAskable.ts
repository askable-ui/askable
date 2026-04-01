import { useState, useEffect, useRef } from 'react';
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
  focus: AskableFocus | null;
  promptContext: string;
  ctx: AskableContext;
}

export function useAskable(options?: {
  events?: AskableEvent[];
  ctx?: AskableContext;
}): UseAskableResult {
  const usesProvidedCtx = Boolean(options?.ctx);
  const ctx = useRef<AskableContext>(options?.ctx ?? getGlobalCtx(options?.events));
  const [focus, setFocus] = useState<AskableFocus | null>(() => ctx.current.getFocus());

  useEffect(() => {
    const current = ctx.current;

    if (!usesProvidedCtx) {
      refCount++;
    }

    const handler = (f: AskableFocus) => setFocus(f);
    current.on('focus', handler);

    return () => {
      current.off('focus', handler);
      if (!usesProvidedCtx) {
        refCount--;
        if (refCount === 0) {
          globalCtx?.destroy();
          globalCtx = null;
        }
      }
    };
  }, [usesProvidedCtx]);

  return {
    focus,
    promptContext: ctx.current.toPromptContext(),
    ctx: ctx.current,
  };
}
