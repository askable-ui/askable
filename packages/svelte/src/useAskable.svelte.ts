import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextOptions, AskableFocus, AskableObserveOptions } from '@askable-ui/core';

export interface UseAskableOptions extends AskableContextOptions {
  observe?: boolean | AskableObserveOptions;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
}

export interface UseAskable {
  readonly focus: AskableFocus | null;
  readonly promptContext: string;
  readonly ctx: AskableContext;
  destroy(): void;
}

/**
 * Svelte 5 runes-based composable for Askable context.
 *
 * Must be used inside a Svelte component or `.svelte.ts` file.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskable } from '@askable-ui/svelte';
 *   const askable = useAskable({ observe: true });
 * </script>
 *
 * <p>{askable.promptContext}</p>
 * ```
 */
export function useAskable(options?: UseAskableOptions): UseAskable {
  const usesProvidedCtx = Boolean(options?.ctx);
  const ctx = options?.ctx ?? createAskableContext(options);

  let focus: AskableFocus | null = $state(null);

  ctx.on('focus', (f) => { focus = f; });
  ctx.on('clear', () => { focus = null; });

  const promptContext = $derived(focus ? ctx.toPromptContext() : 'No UI element is currently focused.');

  if (!usesProvidedCtx && typeof document !== 'undefined') {
    const observeOpts = options?.observe === true
      ? undefined
      : options?.observe === false || options?.observe === undefined
        ? undefined
        : options.observe;

    if (options?.observe !== false) {
      ctx.observe(document, observeOpts);
    }
  }

  function destroy() {
    if (!usesProvidedCtx) ctx.destroy();
  }

  return {
    get focus() { return focus; },
    get promptContext() { return promptContext; },
    ctx,
    destroy,
  };
}
