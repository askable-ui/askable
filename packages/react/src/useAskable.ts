import { useState, useEffect, useRef } from 'react';
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
  focus: AskableFocus | null;
  promptContext: string;
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

export function useAskable(options?: UseAskableOptions): UseAskableResult {
  const usesProvidedCtx = Boolean(options?.ctx);
  // Use a private context when context-creation options are specified
  const usePrivateCtx = !usesProvidedCtx && hasContextCreationOptions(options);

  const ctx = useRef<AskableContext>(
    options?.ctx ?? (usePrivateCtx ? createAskableContext(options) : getGlobalCtx())
  );
  const [focus, setFocus] = useState<AskableFocus | null>(() => ctx.current.getFocus());

  useEffect(() => {
    const current = ctx.current;

    if (!usesProvidedCtx) {
      if (!usePrivateCtx) refCount++;
      if (typeof document !== 'undefined') {
        current.observe(document, { events: options?.events });
      }
    }

    const handler = (f: AskableFocus) => setFocus(f);
    const clearHandler = (_: null) => setFocus(null);
    current.on('focus', handler);
    current.on('clear', clearHandler);

    return () => {
      current.off('focus', handler);
      current.off('clear', clearHandler);
      if (!usesProvidedCtx) {
        if (usePrivateCtx) {
          current.destroy();
        } else {
          refCount--;
          if (refCount === 0) {
            globalCtx?.destroy();
            globalCtx = null;
          }
        }
      }
    };
  }, [options?.events, usesProvidedCtx, usePrivateCtx]);

  return {
    focus,
    promptContext: ctx.current.toPromptContext(),
    ctx: ctx.current,
  };
}
