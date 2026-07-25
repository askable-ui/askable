import { ref, computed, onMounted, onUnmounted } from 'vue';
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
  focus: ReturnType<typeof ref<AskableFocus | null>>;
  promptContext: ReturnType<typeof computed<string>>;
  ctx: AskableContext;
}

export function useAskable(options?: UseAskableOptions) {
  const usesProvidedCtx = Boolean(options?.ctx);
  // Use a private context when context-creation options are specified without a shared name
  const usePrivateCtx = !usesProvidedCtx && requiresPrivateContext(options);

  const ctx = options?.ctx ?? (usePrivateCtx ? createAdapterContext(options) : getGlobalCtx(options));
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
  let inspectorHandle: { destroy(): void } | null = null;

  function clearHandler(_: null) {
    focus.value = null;
  }

  onMounted(() => {
    if (!usesProvidedCtx) {
      if (usePrivateCtx) {
        if (typeof document !== 'undefined') {
          ctx.observe(document, { events: options?.events });
        }
      } else {
        retainGlobalCtx(ctx, options?.name, options?.events, options?.viewport);
      }
    }
    ctx.on('focus', handler);
    ctx.on('clear', clearHandler);

    if (options?.inspector) {
      const inspectorOpts = typeof options.inspector === 'object' ? options.inspector : {};
      inspectorHandle = createAskableInspector(ctx, inspectorOpts);
    }
  });

  onUnmounted(() => {
    inspectorHandle?.destroy();
    ctx.off('focus', handler);
    ctx.off('clear', clearHandler);
    if (!usesProvidedCtx) {
      if (usePrivateCtx) {
        ctx.destroy();
      } else {
        releaseGlobalCtx(options?.name, options?.events, options?.viewport);
      }
    }
  });

  return { focus, promptContext, ctx };
}
