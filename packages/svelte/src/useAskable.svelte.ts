import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextOptions, AskableFocus, AskableObserveOptions } from '@askable-ui/core';

const namedRegistry = new Map<string, { ctx: AskableContext; refCount: number }>();

function getNamedCtx(name: string, options?: AskableContextOptions): AskableContext {
  if (typeof window === 'undefined') return createAskableContext(options);
  const entry = namedRegistry.get(name);
  if (entry) { entry.refCount++; return entry.ctx; }
  const ctx = createAskableContext(options);
  namedRegistry.set(name, { ctx, refCount: 1 });
  return ctx;
}

function releaseNamedCtx(name: string): void {
  const entry = namedRegistry.get(name);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount === 0) { entry.ctx.destroy(); namedRegistry.delete(name); }
}

export interface UseAskableOptions extends AskableContextOptions {
  observe?: boolean | AskableObserveOptions;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Scope this composable to a named context. Multiple components using the same
   * `name` share one context instance. Useful for pages with independent AI regions.
   */
  name?: string;
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
  const usesNamedCtx = !usesProvidedCtx && Boolean(options?.name);
  const ctx = options?.ctx
    ?? (usesNamedCtx ? getNamedCtx(options!.name!, options) : createAskableContext(options));

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
    if (!usesProvidedCtx) {
      if (usesNamedCtx) releaseNamedCtx(options!.name!);
      else ctx.destroy();
    }
  }

  return {
    get focus() { return focus; },
    get promptContext() { return promptContext; },
    ctx,
    destroy,
  };
}
