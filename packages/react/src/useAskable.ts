import { useState, useEffect, useMemo, useRef } from 'react';
import { createAskableContext, createAskableInspector } from '@askable-ui/core';
import type { AskableContextOptions, AskableEvent, AskableFocus, AskableContext, AskableInspectorOptions } from '@askable-ui/core';

const DEFAULT_EVENTS: AskableEvent[] = ['click', 'hover', 'focus'];
const globalCtxByEvents = new Map<string, AskableContext>();
const globalRefCountByEvents = new Map<string, number>();

function normalizeEvents(events?: AskableEvent[]): AskableEvent[] {
  const configured = events ?? DEFAULT_EVENTS;
  return DEFAULT_EVENTS.filter((event, index) => configured.includes(event) && configured.indexOf(event) === index);
}

function getEventsKey(events?: AskableEvent[]): string {
  return normalizeEvents(events).join('|');
}

function getGlobalCtx(events?: AskableEvent[]): AskableContext {
  // During SSR (no window), never persist to the module-level singleton —
  // each render gets a fresh throwaway context so requests don't share state.
  if (typeof window === 'undefined') {
    return createAskableContext();
  }
  const key = getEventsKey(events);
  const existing = globalCtxByEvents.get(key);
  if (existing) return existing;
  const ctx = createAskableContext();
  globalCtxByEvents.set(key, ctx);
  return ctx;
}

function retainGlobalCtx(ctx: AskableContext, events?: AskableEvent[]): void {
  const key = getEventsKey(events);
  const nextCount = (globalRefCountByEvents.get(key) ?? 0) + 1;
  globalRefCountByEvents.set(key, nextCount);
  if (nextCount === 1 && typeof document !== 'undefined') {
    ctx.observe(document, { events: normalizeEvents(events) });
  }
}

function releaseGlobalCtx(events?: AskableEvent[]): void {
  const key = getEventsKey(events);
  const ctx = globalCtxByEvents.get(key);
  if (!ctx) return;
  const nextCount = (globalRefCountByEvents.get(key) ?? 0) - 1;
  if (nextCount > 0) {
    globalRefCountByEvents.set(key, nextCount);
    return;
  }
  globalRefCountByEvents.delete(key);
  globalCtxByEvents.delete(key);
  ctx.destroy();
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

  const eventsKey = getEventsKey(options?.events);
  const privateCtxRef = useRef<AskableContext | null>(null);

  const sharedCtx = useMemo<AskableContext | null>(() => {
    if (options?.ctx || usePrivateCtx) return null;
    return getGlobalCtx(options?.events);
  }, [options?.ctx, usePrivateCtx, eventsKey]);

  if (!options?.ctx && usePrivateCtx && !privateCtxRef.current) {
    privateCtxRef.current = createAskableContext(options);
  }
  if (!usePrivateCtx && !options?.ctx) {
    privateCtxRef.current = null;
  }

  const ctx = options?.ctx ?? privateCtxRef.current ?? sharedCtx!;
  const [focus, setFocus] = useState<AskableFocus | null>(() => ctx.getFocus());

  const inspectorKey = JSON.stringify(options?.inspector ?? false);

  useEffect(() => {
    setFocus(ctx.getFocus());
  }, [ctx]);

  useEffect(() => {
    const current = ctx;

    if (!usesProvidedCtx) {
      if (usePrivateCtx) {
        if (typeof document !== 'undefined') {
          current.observe(document, { events: options?.events });
        }
      } else {
        retainGlobalCtx(current, options?.events);
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
        if (usePrivateCtx) {
          current.destroy();
          if (privateCtxRef.current === current) {
            privateCtxRef.current = null;
          }
        } else {
          releaseGlobalCtx(options?.events);
        }
      }
    };
  }, [ctx, eventsKey, usesProvidedCtx, usePrivateCtx, inspectorKey]);

  return {
    focus,
    promptContext: ctx.toPromptContext(),
    ctx,
  };
}
