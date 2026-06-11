import { useSignal, useVisibleTask$, useTask$ } from '@builder.io/qwik';
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

/**
 * Qwik hook that creates an AskableContext, observes the document, and
 * returns reactive signals for the current focus and prompt context.
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

  // ctx lives outside signals — it's imperatively managed
  let ctx: AskableContext | null = null;

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    ctx = options?.ctx ?? createAskableContext(options);

    if (!options?.ctx) {
      ctx.observe(document, { events: options?.events ?? DEFAULT_EVENTS });
    }

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
      if (!options?.ctx) ctx!.destroy();
      ctx = null;
    });
  });

  return {
    focus,
    promptContext,
    get ctx() { return ctx!; },
  };
}
