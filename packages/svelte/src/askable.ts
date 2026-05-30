import { writable, derived, readonly } from 'svelte/store';
import { createAskableContext, createAskableInspector } from '@askable-ui/core';
import type { AskableEvent, AskableFocus, AskableContext, AskableInspectorOptions, AskableContextOptions } from '@askable-ui/core';

export interface AskableStoreOptions extends Pick<AskableContextOptions, 'name'> {
  events?: AskableEvent[];
  ctx?: AskableContext;
  inspector?: boolean | AskableInspectorOptions;
}

export interface AskableStore {
  focus: ReturnType<typeof readonly>;
  promptContext: ReturnType<typeof derived>;
  ctx: AskableContext;
  destroy: () => void;
}

export function createAskableStore(options?: AskableStoreOptions) {
  const usesProvidedCtx = Boolean(options?.ctx);
  const ctx = options?.ctx ?? createAskableContext(options?.name ? { name: options.name } : undefined);

  if (!usesProvidedCtx && typeof document !== 'undefined') {
    ctx.observe(document, { events: options?.events });
  }

  const _focus = writable<AskableFocus | null>(null);
  const handleFocus = (focus: AskableFocus) => _focus.set(focus);
  const handleClear = () => _focus.set(null);

  ctx.on('focus', handleFocus);
  ctx.on('clear', handleClear);

  const focus = readonly(_focus);
  const promptContext = derived(_focus, () => ctx.toPromptContext());

  let inspectorHandle: { destroy(): void } | null = null;
  if (options?.inspector && typeof document !== 'undefined') {
    const inspectorOpts = typeof options.inspector === 'object' ? options.inspector : {};
    inspectorHandle = createAskableInspector(ctx, inspectorOpts);
  }

  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;

    inspectorHandle?.destroy();
    ctx.off('focus', handleFocus);
    ctx.off('clear', handleClear);
    if (!usesProvidedCtx) {
      ctx.destroy();
    }
  }

  return { focus, promptContext, ctx, destroy };
}
