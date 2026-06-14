import { useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextOptions, AskableEvent, AskableFocus } from '@askable-ui/core';

export interface UseAskableOptions extends AskableContextOptions {
  events?: AskableEvent[];
  ctx?: AskableContext;
}

export interface UseAskableResult {
  focus: ReturnType<typeof useSignal<AskableFocus | null>>;
  promptContext: ReturnType<typeof useSignal<string>>;
  ctx: AskableContext;
}

const DEFAULT_EVENTS: AskableEvent[] = ['click', 'hover', 'focus'];

// Module-level cache so all hooks in the same page share one default context
const globalCtxByKey = new Map<string, AskableContext>();
const globalRefCount = new Map<string, number>();

function sharedKey(options?: UseAskableOptions): string {
  const name = options?.name?.trim() ? `name:${options.name.trim()}` : 'global';
  const evts = (options?.events ?? DEFAULT_EVENTS).slice().sort().join('|');
  return `${name}::${evts}`;
}

function retainCtx(key: string, options?: UseAskableOptions): AskableContext {
  const existing = globalCtxByKey.get(key);
  if (existing) {
    globalRefCount.set(key, (globalRefCount.get(key) ?? 0) + 1);
    return existing;
  }
  const ctx = createAskableContext(options);
  globalCtxByKey.set(key, ctx);
  globalRefCount.set(key, 1);
  ctx.observe(document, { events: options?.events ?? DEFAULT_EVENTS });
  return ctx;
}

function releaseCtx(key: string): void {
  const count = (globalRefCount.get(key) ?? 1) - 1;
  if (count > 0) { globalRefCount.set(key, count); return; }
  globalRefCount.delete(key);
  globalCtxByKey.get(key)?.destroy();
  globalCtxByKey.delete(key);
}

/**
 * Qwik hook that creates (or shares) an AskableContext and returns reactive
 * signals for the current focus and prompt context.
 *
 * Multiple calls with the same options share a single context instance so all
 * source hooks on the page read from the same focus stream.
 *
 * @example
 * ```tsx
 * import { component$ } from '@builder.io/qwik';
 * import { useAskable } from '@askable-ui/qwik';
 *
 * export const MyComponent = component$(() => {
 *   const { promptContext } = useAskable();
 *   return <p>{promptContext.value}</p>;
 * });
 * ```
 */
export function useAskable(options?: UseAskableOptions): UseAskableResult {
  const focus = useSignal<AskableFocus | null>(null);
  const promptContext = useSignal<string>('');
  const usesProvidedCtx = Boolean(options?.ctx);

  let ctx: AskableContext | null = null;
  const key = sharedKey(options);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    ctx = usesProvidedCtx ? options!.ctx! : retainCtx(key, options);

    const handleFocus = (f: AskableFocus) => {
      focus.value = f;
      promptContext.value = ctx!.toPromptContext();
    };
    const handleClear = (_: null) => {
      focus.value = null;
      promptContext.value = '';
    };

    ctx.on('focus', handleFocus);
    ctx.on('clear', handleClear);

    cleanup(() => {
      ctx!.off('focus', handleFocus);
      ctx!.off('clear', handleClear);
      if (!usesProvidedCtx) releaseCtx(key);
      ctx = null;
    });
  });

  return {
    focus,
    promptContext,
    get ctx() { return ctx!; },
  };
}
