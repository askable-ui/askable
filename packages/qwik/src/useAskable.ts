import { noSerialize, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import type { NoSerialize, QRL, SyncQRL } from '@builder.io/qwik';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextOptions, AskableEvent, AskableFocus } from '@askable-ui/core';
import type { AskableContextRef } from './contextRef.js';

export interface UseAskableOptions extends Omit<
  AskableContextOptions,
  'textExtractor' | 'sanitizeMeta' | 'sanitizeText' | 'sanitizeSource'
> {
  events?: AskableEvent[];
  ctx?: AskableContext;
  /** Resume-safe factory for a hook-owned browser context. */
  ctx$?: QRL<() => AskableContext | Promise<AskableContext>>;
  textExtractor?: SyncQRL<NonNullable<AskableContextOptions['textExtractor']>>;
  sanitizeMeta?: SyncQRL<NonNullable<AskableContextOptions['sanitizeMeta']>>;
  sanitizeText?: SyncQRL<NonNullable<AskableContextOptions['sanitizeText']>>;
  sanitizeSource?: QRL<NonNullable<AskableContextOptions['sanitizeSource']>>;
}

export interface UseAskableResult {
  focus: ReturnType<typeof useSignal<AskableFocus | null>>;
  promptContext: ReturnType<typeof useSignal<string>>;
  /** Stable signal populated when the component becomes visible in the browser. */
  ctxRef: AskableContextRef;
  ctx: AskableContext;
}

const DEFAULT_EVENTS: AskableEvent[] = ['click', 'hover', 'focus'];
type ResolvedUseAskableOptions = AskableContextOptions & Pick<UseAskableOptions, 'events'>;

function resolveQrlOrFunction<T extends (...args: any[]) => any>(
  value: QRL<T> | T | undefined,
): T | Promise<T> | undefined {
  return value && 'resolve' in value && typeof value.resolve === 'function'
    ? value.resolve()
    : value as T | undefined;
}

// Module-level cache so all hooks in the same page share one default context
const globalCtxByKey = new Map<string, AskableContext>();
const globalRefCount = new Map<string, number>();

function sharedKey(options?: UseAskableOptions): string {
  const name = options?.name?.trim() ? `name:${options.name.trim()}` : 'global';
  const evts = (options?.events ?? DEFAULT_EVENTS).slice().sort().join('|');
  const viewport = options?.viewport ? 'viewport:on' : 'viewport:off';
  return `${name}::${evts}::${viewport}`;
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

function createAdapterContext(options?: ResolvedUseAskableOptions): AskableContext {
  if (!options?.name) return createAskableContext(options);
  const { name: _name, ...contextOptions } = options;
  return createAskableContext(contextOptions);
}

function retainCtx(key: string, options?: ResolvedUseAskableOptions): AskableContext {
  const existing = globalCtxByKey.get(key);
  if (existing) {
    globalRefCount.set(key, (globalRefCount.get(key) ?? 0) + 1);
    return existing;
  }
  const ctx = createAdapterContext(options);
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
  const ctxRef = useSignal<NoSerialize<AskableContext>>();
  const usesProvidedCtx = Boolean(options?.ctx);
  const usesContextFactory = Boolean(options?.ctx$);
  const usePrivateCtx = !usesProvidedCtx && !usesContextFactory && requiresPrivateContext(options);
  const providedCtx = options?.ctx ? noSerialize(options.ctx) : undefined;
  const providedCtxFactory = options?.ctx$;
  const {
    ctx: _providedCtx,
    ctx$: _providedCtxFactory,
    textExtractor,
    sanitizeMeta,
    sanitizeText,
    sanitizeSource,
    ...contextOptions
  } = options ?? {};

  const key = sharedKey(options);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    let disposed = false;
    let ctx: AskableContext | undefined;
    let subscribed = false;

    const handleFocus = (focusValue: AskableFocus) => {
      focus.value = focusValue;
      promptContext.value = ctx!.toPromptContext();
    };
    const handleClear = (_: null) => {
      focus.value = null;
      promptContext.value = '';
    };

    cleanup(() => {
      disposed = true;
      if (!ctx) return;
      if (subscribed) {
        ctx.off('focus', handleFocus);
        ctx.off('clear', handleClear);
      }
      if (!usesProvidedCtx) {
        if (usePrivateCtx || usesContextFactory) ctx.destroy();
        else releaseCtx(key);
      }
      if (ctxRef.value === ctx) ctxRef.value = undefined;
    });

    try {
      const callbackValues = [
        resolveQrlOrFunction(textExtractor),
        resolveQrlOrFunction(sanitizeMeta),
        resolveQrlOrFunction(sanitizeText),
        resolveQrlOrFunction(sanitizeSource),
      ] as const;
      const resolvedCallbacks = (callbackValues.some(
        (value) => value && typeof (value as Promise<unknown>).then === 'function',
      )
        ? await Promise.all(callbackValues)
        : callbackValues) as [
          AskableContextOptions['textExtractor'],
          AskableContextOptions['sanitizeMeta'],
          AskableContextOptions['sanitizeText'],
          AskableContextOptions['sanitizeSource'],
        ];
      const [
        resolvedTextExtractor,
        resolvedSanitizeMeta,
        resolvedSanitizeText,
        resolvedSanitizeSource,
      ] = resolvedCallbacks;
      const resolvedContextOptions = {
        ...contextOptions,
        textExtractor: resolvedTextExtractor,
        sanitizeMeta: resolvedSanitizeMeta,
        sanitizeText: resolvedSanitizeText,
        sanitizeSource: resolvedSanitizeSource,
      };
      ctx = usesProvidedCtx
        ? providedCtx
        : usesContextFactory
          ? await providedCtxFactory!()
          : usePrivateCtx
            ? createAdapterContext(resolvedContextOptions)
            : retainCtx(key, resolvedContextOptions);
    } catch (error) {
      if (disposed) return;
      throw error;
    }
    if (!ctx) {
      throw new Error(
        'Provided Askable context was not available after Qwik resume; pass ctx$ for SSR-resumable ownership',
      );
    }
    if (disposed) {
      if (usesContextFactory) ctx.destroy();
      return;
    }
    ctxRef.value = noSerialize(ctx);
    if (usePrivateCtx || usesContextFactory) {
      ctx.observe(document, { events: contextOptions.events ?? DEFAULT_EVENTS });
    }

    ctx.on('focus', handleFocus);
    ctx.on('clear', handleClear);
    subscribed = true;
  });

  return {
    focus,
    promptContext,
    ctxRef,
    get ctx() { return ctxRef.value!; },
  };
}
