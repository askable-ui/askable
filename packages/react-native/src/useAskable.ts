import { useEffect, useState } from 'react';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextOptions, AskableFocus } from '@askable-ui/core';

export interface UseAskableOptions extends AskableContextOptions {
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
}

export interface UseAskableResult {
  focus: AskableFocus | null;
  promptContext: string;
  ctx: AskableContext;
}

export function useAskable(options?: UseAskableOptions): UseAskableResult {
  const [ctx] = useState<AskableContext>(() => options?.ctx ?? createAskableContext(options));
  const [focus, setFocus] = useState<AskableFocus | null>(() => ctx.getFocus());

  useEffect(() => {
    const handleFocus = (nextFocus: AskableFocus) => setFocus(nextFocus);
    const handleClear = (_: null) => setFocus(null);

    ctx.on('focus', handleFocus);
    ctx.on('clear', handleClear);

    return () => {
      ctx.off('focus', handleFocus);
      ctx.off('clear', handleClear);
      if (!options?.ctx) {
        ctx.destroy();
      }
    };
  }, [ctx, options?.ctx]);

  return {
    focus,
    promptContext: ctx.toPromptContext(),
    ctx,
  };
}
