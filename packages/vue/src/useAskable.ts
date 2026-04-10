import { ref, computed, onMounted, onUnmounted } from 'vue';
import { createAskableContext, createAskableInspector } from '@askable-ui/core';
import type { AskableContextOptions, AskableEvent, AskableFocus, AskableContext, AskableInspectorOptions } from '@askable-ui/core';

let globalCtx: AskableContext | null = null;
let refCount = 0;

const namedRegistry = new Map<string, { ctx: AskableContext; refCount: number }>();

function getGlobalCtx(): AskableContext {
  if (typeof window === 'undefined') return createAskableContext();
  if (!globalCtx) globalCtx = createAskableContext();
  return globalCtx;
}

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
  events?: AskableEvent[];
  /**
   * Provide a pre-created context. When set, all `AskableContextOptions`
   * (maxHistory, sanitizeMeta, etc.) are ignored — configure those on the
   * context you pass in.
   */
  ctx?: AskableContext;
  /** Mount the floating inspector dev panel. Pass true for defaults or an options object. */
  inspector?: boolean | AskableInspectorOptions;
  /**
   * Scope this composable to a named context. Multiple components using the same
   * `name` share one context instance. Useful for pages with independent AI regions.
   */
  name?: string;
}

export interface UseAskableResult {
  focus: ReturnType<typeof ref<AskableFocus | null>>;
  promptContext: ReturnType<typeof computed<string>>;
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

export function useAskable(options?: UseAskableOptions) {
  const usesProvidedCtx = Boolean(options?.ctx);
  const usesNamedCtx = !usesProvidedCtx && Boolean(options?.name);
  const usePrivateCtx = !usesProvidedCtx && !usesNamedCtx && hasContextCreationOptions(options);

  const ctx = options?.ctx
    ?? (usesNamedCtx ? getNamedCtx(options!.name!, options) : undefined)
    ?? (usePrivateCtx ? createAskableContext(options) : getGlobalCtx());
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
      if (!usePrivateCtx && !usesNamedCtx) refCount++;
      if (typeof document !== 'undefined') {
        ctx.observe(document, { events: options?.events });
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
      if (usesNamedCtx) {
        releaseNamedCtx(options!.name!);
      } else if (usePrivateCtx) {
        ctx.destroy();
      } else {
        refCount--;
        if (refCount === 0) {
          globalCtx?.destroy();
          globalCtx = null;
        }
      }
    }
  });

  return { focus, promptContext, ctx };
}
