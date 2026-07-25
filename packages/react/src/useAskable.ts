import { useState, useEffect, useMemo, useRef } from 'react';
import { createAskableContext, createAskableInspector } from '@askable-ui/core';
import type { AskableContextOptions, AskableEvent, AskableFocus, AskableContext, AskableInspectorOptions } from '@askable-ui/core';

const DEFAULT_EVENTS: AskableEvent[] = ['click', 'hover', 'focus'];
const globalCtxByEvents = new Map<string, AskableContext>();
const globalRefCountByEvents = new Map<string, number>();
const pendingGlobalReleaseByEvents = new Map<string, symbol>();

function normalizeEvents(events?: AskableEvent[]): AskableEvent[] {
  const configured = events ?? DEFAULT_EVENTS;
  return DEFAULT_EVENTS.filter((event) => configured.includes(event));
}

function getEventsKey(events?: AskableEvent[]): string {
  return normalizeEvents(events).join('|');
}

function getSharedKey(name?: string, events?: AskableEvent[], viewport?: boolean): string {
  const scope = name?.trim() ? `name:${name.trim()}` : 'global';
  const viewportKey = viewport ? 'viewport:on' : 'viewport:off';
  return `${scope}::${getEventsKey(events)}::${viewportKey}`;
}

function requiresPrivateContext(options?: UseAskableOptions): boolean {
  if (options?.name?.trim()) return false;
  return Boolean(
    options?.maxHistory !== undefined ||
    options?.sanitizeMeta ||
    options?.sanitizeText ||
    options?.sanitizeSource ||
    options?.textExtractor
  );
}

// Adapter caches own named-context lifetime. Strip the core-level name so one
// adapter/key cannot destroy a context retained under another adapter/key.
function createAdapterContext(options?: UseAskableOptions): AskableContext {
  if (!options?.name) return createAskableContext(options);
  const { name: _name, ...contextOptions } = options;
  return createAskableContext(contextOptions);
}

function getGlobalCtx(options?: UseAskableOptions): AskableContext {
  // During SSR (no window), never persist to the module-level singleton —
  // each render gets a fresh throwaway context so requests don't share state.
  if (typeof window === 'undefined') {
    return createAdapterContext(options);
  }
  const key = getSharedKey(options?.name, options?.events, options?.viewport);
  const existing = globalCtxByEvents.get(key);
  if (existing) return existing;
  const ctx = createAdapterContext(options);
  globalCtxByEvents.set(key, ctx);
  return ctx;
}

function retainGlobalCtx(ctx: AskableContext, name?: string, events?: AskableEvent[], viewport?: boolean): void {
  const key = getSharedKey(name, events, viewport);
  pendingGlobalReleaseByEvents.delete(key);
  const nextCount = (globalRefCountByEvents.get(key) ?? 0) + 1;
  globalRefCountByEvents.set(key, nextCount);
  if (nextCount === 1 && typeof document !== 'undefined') {
    ctx.observe(document, { events: normalizeEvents(events) });
  }
}

function releaseGlobalCtx(name?: string, events?: AskableEvent[], viewport?: boolean): void {
  const key = getSharedKey(name, events, viewport);
  const ctx = globalCtxByEvents.get(key);
  if (!ctx) return;
  const nextCount = (globalRefCountByEvents.get(key) ?? 0) - 1;
  if (nextCount > 0) {
    globalRefCountByEvents.set(key, nextCount);
    return;
  }
  globalRefCountByEvents.set(key, 0);
  ctx.unobserve();

  const releaseToken = Symbol('askable-shared-context-release');
  pendingGlobalReleaseByEvents.set(key, releaseToken);
  queueMicrotask(() => {
    if (pendingGlobalReleaseByEvents.get(key) !== releaseToken) return;
    if ((globalRefCountByEvents.get(key) ?? 0) > 0) return;
    if (globalCtxByEvents.get(key) !== ctx) return;

    pendingGlobalReleaseByEvents.delete(key);
    globalRefCountByEvents.delete(key);
    globalCtxByEvents.delete(key);
    ctx.destroy();
  });
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

export function useAskable(options?: UseAskableOptions): UseAskableResult {
  const usesProvidedCtx = Boolean(options?.ctx);
  // Use a private context when context-creation options are specified without a shared name
  const usePrivateCtx = !usesProvidedCtx && requiresPrivateContext(options);

  const sharedKey = getSharedKey(options?.name, options?.events, options?.viewport);
  const privateCtxRef = useRef<AskableContext | null>(null);

  const sharedCtx = useMemo<AskableContext | null>(() => {
    if (options?.ctx || usePrivateCtx) return null;
    return getGlobalCtx(options);
  }, [options?.ctx, usePrivateCtx, sharedKey]);

  if (!options?.ctx && usePrivateCtx && !privateCtxRef.current) {
    privateCtxRef.current = createAdapterContext(options);
  }
  if (!usePrivateCtx && !options?.ctx) {
    privateCtxRef.current = null;
  }

  const ctx = options?.ctx ?? privateCtxRef.current ?? sharedCtx!;
  const privateLifecycleTokensRef = useRef(new WeakMap<AskableContext, symbol>());
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
        retainGlobalCtx(current, options?.name, options?.events, options?.viewport);
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
          current.unobserve();
        } else {
          releaseGlobalCtx(options?.name, options?.events, options?.viewport);
        }
      }
    };
  }, [ctx, sharedKey, usesProvidedCtx, usePrivateCtx, inspectorKey]);

  // Strict Mode replays effects in development. A deferred, token-guarded
  // teardown lets the replay claim the context before the microtask runs.
  useEffect(() => {
    if (!usePrivateCtx) return;
    const current = ctx;
    const token = Symbol('askable-private-context');
    privateLifecycleTokensRef.current.set(current, token);

    return () => {
      queueMicrotask(() => {
        if (privateLifecycleTokensRef.current.get(current) !== token) return;
        current.destroy();
        privateLifecycleTokensRef.current.delete(current);
        if (privateCtxRef.current === current) privateCtxRef.current = null;
      });
    };
  }, [ctx, usePrivateCtx]);

  return {
    focus,
    promptContext: ctx.toPromptContext(),
    ctx,
  };
}
