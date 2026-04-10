import { useState, useEffect, useRef } from 'react';
import { createAskableContext, createAskableInspector } from '@askable-ui/core';
import type { AskableContextOptions, AskableEvent, AskableFocus, AskableContext, AskableInspectorOptions } from '@askable-ui/core';

let globalCtx: AskableContext | null = null;
let refCount = 0;

// Registry for named/scoped contexts — keyed by name, reference-counted.
const namedRegistry = new Map<string, { ctx: AskableContext; refCount: number }>();

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

function getNamedCtx(name: string, options?: AskableContextOptions): AskableContext {
  if (typeof window === 'undefined') return createAskableContext(options);
  const entry = namedRegistry.get(name);
  if (entry) {
    entry.refCount++;
    return entry.ctx;
  }
  const ctx = createAskableContext(options);
  namedRegistry.set(name, { ctx, refCount: 1 });
  return ctx;
}

function releaseNamedCtx(name: string): void {
  const entry = namedRegistry.get(name);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount === 0) {
    entry.ctx.destroy();
    namedRegistry.delete(name);
  }
}

export interface UseAskableOptions extends AskableContextOptions {
  events?: AskableEvent[];
  /**
   * Provide a pre-created context. When set, all `AskableContextOptions`
   * (maxHistory, sanitizeMeta, etc.) are ignored — configure those on the
   * context you pass in.
   */
  ctx?: AskableContext;
  /** Mount the floating inspector dev panel. Pass true for defaults or an options object. */
  inspector?: boolean | AskableInspectorOptions;
  /**
   * Scope this hook to a named context. Multiple components using the same `name`
   * share one context instance (reference-counted, destroyed when the last
   * component unmounts). Useful for pages with multiple independent AI regions.
   *
   * @example
   * const { ctx } = useAskable({ name: 'table' });
   * const { ctx } = useAskable({ name: 'chart' });
   */
  name?: string;
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
  const usesNamedCtx = !usesProvidedCtx && Boolean(options?.name);
  // Use a private context when context-creation options are specified (and no name/ctx provided)
  const usePrivateCtx = !usesProvidedCtx && !usesNamedCtx && hasContextCreationOptions(options);

  const ctx = useRef<AskableContext>(
    options?.ctx
      ?? (usesNamedCtx ? getNamedCtx(options!.name!, options) : undefined)
      ?? (usePrivateCtx ? createAskableContext(options) : getGlobalCtx())
  );
  const [focus, setFocus] = useState<AskableFocus | null>(() => ctx.current.getFocus());

  // Stable serialized key for inspector so the effect re-runs when it changes,
  // without false positives when a new object literal with the same shape is passed.
  const inspectorKey = options?.inspector === true
    ? 'true'
    : options?.inspector
      ? JSON.stringify(options.inspector)
      : 'false';

  useEffect(() => {
    const current = ctx.current;

    if (!usesProvidedCtx) {
      if (!usePrivateCtx && !usesNamedCtx) refCount++;
      if (typeof document !== 'undefined') {
        current.observe(document, { events: options?.events });
      }
    }

    const handler = (f: AskableFocus) => setFocus(f);
    const clearHandler = (_: null) => setFocus(null);
    current.on('focus', handler);
    current.on('clear', clearHandler);

    let inspectorHandle: { destroy(): void } | null = null;
    if (options?.inspector) {
      const inspectorOpts = typeof options.inspector === 'object' ? options.inspector : {};
      inspectorHandle = createAskableInspector(current, inspectorOpts);
    }

    return () => {
      inspectorHandle?.destroy();
      current.off('focus', handler);
      current.off('clear', clearHandler);
      if (!usesProvidedCtx) {
        if (usesNamedCtx) {
          releaseNamedCtx(options!.name!);
        } else if (usePrivateCtx) {
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
  // inspectorKey captures changes to the inspector option value
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.events, usesProvidedCtx, usesNamedCtx, usePrivateCtx, inspectorKey]);

  return {
    focus,
    promptContext: ctx.current.toPromptContext(),
    ctx: ctx.current,
  };
}
