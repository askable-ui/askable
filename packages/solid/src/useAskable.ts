import { createSignal, createEffect, onCleanup } from 'solid-js';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContextOptions, AskableEvent, AskableFocus, AskableContext } from '@askable-ui/core';

const DEFAULT_EVENTS: AskableEvent[] = ['click', 'hover', 'focus'];
const globalCtxByKey = new Map<string, AskableContext>();
const globalRefCountByKey = new Map<string, number>();

function normalizeEvents(events?: AskableEvent[]): AskableEvent[] {
  const configured = events ?? DEFAULT_EVENTS;
  return DEFAULT_EVENTS.filter((event) => configured.includes(event));
}

function getSharedKey(name?: string, events?: AskableEvent[], viewport?: boolean): string {
  const scope = name?.trim() ? `name:${name.trim()}` : 'global';
  const viewportKey = viewport ? 'viewport:on' : 'viewport:off';
  return `${scope}::${normalizeEvents(events).join('|')}::${viewportKey}`;
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

function createAdapterContext(options?: UseAskableOptions): AskableContext {
  if (!options?.name) return createAskableContext(options);
  const { name: _name, ...contextOptions } = options;
  return createAskableContext(contextOptions);
}

function retainGlobalCtx(key: string, options?: UseAskableOptions): AskableContext {
  if (typeof window === 'undefined') return createAdapterContext(options);
  const existing = globalCtxByKey.get(key);
  if (existing) {
    globalRefCountByKey.set(key, (globalRefCountByKey.get(key) ?? 0) + 1);
    return existing;
  }
  const ctx = createAdapterContext(options);
  globalCtxByKey.set(key, ctx);
  globalRefCountByKey.set(key, 1);
  if (typeof document !== 'undefined') {
    ctx.observe(document, { events: normalizeEvents(options?.events) });
  }
  return ctx;
}

function releaseGlobalCtx(key: string): void {
  const ctx = globalCtxByKey.get(key);
  if (!ctx) return;
  const next = (globalRefCountByKey.get(key) ?? 1) - 1;
  if (next > 0) { globalRefCountByKey.set(key, next); return; }
  globalRefCountByKey.delete(key);
  globalCtxByKey.delete(key);
  ctx.destroy();
}

export interface UseAskableOptions extends AskableContextOptions {
  events?: AskableEvent[];
  ctx?: AskableContext;
}

export interface UseAskableResult {
  focus: () => AskableFocus | null;
  promptContext: () => string;
  ctx: AskableContext;
}

export function useAskable(options?: UseAskableOptions): UseAskableResult {
  const usesProvidedCtx = Boolean(options?.ctx);
  const usePrivateCtx = !usesProvidedCtx && requiresPrivateContext(options);
  const sharedKey = getSharedKey(options?.name, options?.events, options?.viewport);

  const ctx = options?.ctx ?? (usePrivateCtx
    ? createAdapterContext(options)
    : retainGlobalCtx(sharedKey, options));
  if (usePrivateCtx && typeof document !== 'undefined') {
    ctx.observe(document, { events: normalizeEvents(options?.events) });
  }
  const [focus, setFocus] = createSignal<AskableFocus | null>(ctx.getFocus());

  createEffect(() => {
    const handleFocus = (f: AskableFocus) => setFocus(() => f);
    const handleClear = () => setFocus(null);

    ctx.on('focus', handleFocus);
    ctx.on('clear', handleClear);

    onCleanup(() => {
      ctx.off('focus', handleFocus);
      ctx.off('clear', handleClear);
      if (!usesProvidedCtx) {
        if (usePrivateCtx) ctx.destroy();
        else releaseGlobalCtx(sharedKey);
      }
    });
  });

  const promptContext = () => {
    void focus(); // track reactivity
    return ctx.toPromptContext();
  };

  return { focus, promptContext, ctx };
}
