import { writable, derived, readonly } from 'svelte/store';
import {
  createAskableContext,
  createAskableInspector,
  createAskableRegionCapture,
  createAskableTextSelectionCapture,
} from '@askable-ui/core';
import type {
  AskableAsyncPromptContextOptions,
  AskableEvent,
  AskableFocus,
  AskableContext,
  AskableContextSource,
  AskableContextSourceRequest,
  AskableInspectorOptions,
  AskableContextOptions,
  AskableRegionCaptureHandle,
  AskableRegionCaptureOptions,
  AskableRegionCaptureSelection,
  AskableRegionCaptureState,
  AskableTextSelectionCaptureHandle,
  AskableTextSelectionCaptureOptions,
  AskableTextSelectionCaptureSelection,
  AskableTextSelectionCaptureState,
  AskableResolvedContextSource,
  WebContextPacket,
} from '@askable-ui/core';

// ── Viewport store types ────────────────────────────────────────────────────

export interface AskableViewportStoreOptions {
  root?: HTMLElement;
  threshold?: number | number[];
  scope?: string;
}

export interface AskableViewportStore {
  visibleItems: ReturnType<typeof readonly>;
  promptContext: ReturnType<typeof derived>;
  observe: (root?: HTMLElement) => void;
  destroy: () => void;
}

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

export interface AskableRegionCaptureStoreOptions extends AskableStoreOptions, AskableRegionCaptureOptions {}

export interface AskableRegionCaptureStore {
  active: ReturnType<typeof readonly>;
  lastPacket: ReturnType<typeof readonly>;
  lastSelection: ReturnType<typeof readonly>;
  selectionState: ReturnType<typeof readonly>;
  ctx: AskableContext;
  start: (overrides?: Partial<AskableRegionCaptureOptions>) => void;
  cancel: () => void;
  clearSelection: () => void;
  getSelection: () => AskableRegionCaptureState | null;
  destroy: () => void;
  isActive: () => boolean;
}

export interface AskableTextSelectionCaptureStoreOptions extends AskableStoreOptions, AskableTextSelectionCaptureOptions {}

export interface AskableTextSelectionCaptureStore {
  active: ReturnType<typeof readonly>;
  lastPacket: ReturnType<typeof readonly>;
  lastSelection: ReturnType<typeof readonly>;
  selectionState: ReturnType<typeof readonly>;
  ctx: AskableContext;
  start: (overrides?: Partial<AskableTextSelectionCaptureOptions>) => void;
  captureNow: (overrides?: Partial<AskableTextSelectionCaptureOptions>) => WebContextPacket | null;
  cancel: () => void;
  clearSelection: () => void;
  getSelection: () => AskableTextSelectionCaptureState | null;
  destroy: () => void;
  isActive: () => boolean;
}

export interface AskableSourceStoreOptions extends AskableStoreOptions {
  /** Register the source while true. Defaults to true. */
  enabled?: boolean;
}

export interface AskableSourceStore {
  ctx: AskableContext;
  sourceId: string;
  resolve: (request?: Omit<AskableContextSourceRequest, 'id'>) => Promise<AskableResolvedContextSource>;
  toPromptContext: (
    options?: Omit<AskableAsyncPromptContextOptions, 'sources'>
      & { source?: Omit<AskableContextSourceRequest, 'id'> },
  ) => Promise<string>;
  notifyChanged: () => void;
  unregister: () => void;
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

export function createAskableSourceStore(
  id: string,
  source: AskableContextSource,
  options: AskableSourceStoreOptions = {},
): AskableSourceStore {
  const { enabled = true, ...storeOptions } = options;
  const askable = createAskableStore(storeOptions);
  const sourceId = id.trim();
  let registered = false;
  let handle: ReturnType<AskableContext['registerSource']> | null = null;

  function buildProxy(): AskableContextSource {
    return {
      get kind() {
        return source.kind;
      },
      get modes() {
        return source.modes;
      },
      describe: () => {
        const describe = source.describe;
        if (typeof describe === 'function') return describe();
        return describe ?? '';
      },
      getState: () => source.getState?.(),
      resolve: (request) => source.resolve?.(request),
      sanitize: (resolved) => source.sanitize?.(resolved) ?? resolved,
    };
  }

  function unregister() {
    if (!registered) return;
    handle?.unregister();
    handle = null;
    registered = false;
  }

  if (enabled && sourceId) {
    handle = askable.ctx.registerSource(sourceId, buildProxy());
    registered = true;
  }

  function notifyChanged() {
    handle?.notifyChanged();
  }

  function destroy() {
    unregister();
    askable.destroy();
  }

  return {
    ctx: askable.ctx,
    sourceId,
    resolve: (request?: Omit<AskableContextSourceRequest, 'id'>) => askable.ctx.resolveSource(sourceId, request),
    toPromptContext: (promptOptions?: Omit<AskableAsyncPromptContextOptions, 'sources'>
      & { source?: Omit<AskableContextSourceRequest, 'id'> }) => {
      const { source: sourceRequest, ...rest } = promptOptions ?? {};
      return askable.ctx.toPromptContextAsync({
        ...rest,
        sources: [{ id: sourceId, ...sourceRequest }],
      });
    },
    notifyChanged,
    unregister,
    destroy,
  };
}

export function createAskableRegionCaptureStore(
  options: AskableRegionCaptureStoreOptions = {},
): AskableRegionCaptureStore {
  const { ctx, name, events, inspector, ...regionOptions } = options;
  const askable = createAskableStore({ ctx, name, events, inspector });
  const _active = writable(false);
  const _lastPacket = writable<WebContextPacket | null>(null);
  const _lastSelection = writable<AskableRegionCaptureSelection | null>(null);
  const _selectionState = writable<AskableRegionCaptureState | null>(null);
  let handle: AskableRegionCaptureHandle | null = null;

  function destroyCapture() {
    handle?.destroy();
    handle = null;
    _active.set(false);
    _selectionState.set(null);
  }

  function start(overrides?: Partial<AskableRegionCaptureOptions>) {
    handle?.destroy();

    const currentOptions = {
      ...regionOptions,
      ...overrides,
    };

    handle = createAskableRegionCapture(askable.ctx, {
      ...currentOptions,
      onCapture(packet, selection) {
        _lastPacket.set(packet);
        _lastSelection.set(selection);
        if (currentOptions.once === false) {
          _active.set(true);
        } else {
          _active.set(false);
        }
        currentOptions.onCapture?.(packet, selection);
      },
      onCancel() {
        handle = null;
        _active.set(false);
        currentOptions.onCancel?.();
      },
      onSelectionChange(state) {
        _selectionState.set(state);
        currentOptions.onSelectionChange?.(state);
      },
    });

    handle.start();
    _active.set(true);
  }

  function cancel() {
    handle?.cancel();
    handle = null;
    _active.set(false);
    _selectionState.set(null);
  }

  function clearSelection() {
    handle?.clearSelection();
    if (!handle) _selectionState.set(null);
  }

  function getSelection() {
    return handle?.getSelection() ?? null;
  }

  function destroy() {
    destroyCapture();
    askable.destroy();
  }

  function isActive() {
    return handle?.isActive() ?? false;
  }

  return {
    active: readonly(_active),
    lastPacket: readonly(_lastPacket),
    lastSelection: readonly(_lastSelection),
    selectionState: readonly(_selectionState),
    ctx: askable.ctx,
    start,
    cancel,
    clearSelection,
    getSelection,
    destroy,
    isActive,
  };
}

export function createAskableTextSelectionCaptureStore(
  options: AskableTextSelectionCaptureStoreOptions = {},
): AskableTextSelectionCaptureStore {
  const { ctx, name, events, inspector, ...selectionOptions } = options;
  const askable = createAskableStore({ ctx, name, events, inspector });
  const _active = writable(false);
  const _lastPacket = writable<WebContextPacket | null>(null);
  const _lastSelection = writable<AskableTextSelectionCaptureSelection | null>(null);
  const _selectionState = writable<AskableTextSelectionCaptureState | null>(null);
  let handle: AskableTextSelectionCaptureHandle | null = null;

  function destroyCapture() {
    handle?.destroy();
    handle = null;
    _active.set(false);
    _selectionState.set(null);
  }

  function ensureHandle(overrides?: Partial<AskableTextSelectionCaptureOptions>) {
    handle?.destroy();

    const currentOptions = {
      ...selectionOptions,
      ...overrides,
    };

    handle = createAskableTextSelectionCapture(askable.ctx, {
      ...currentOptions,
      onCapture(packet, selection) {
        _lastPacket.set(packet);
        _lastSelection.set(selection);
        if (currentOptions.once) {
          _active.set(false);
        }
        currentOptions.onCapture?.(packet, selection);
      },
      onCancel() {
        handle = null;
        _active.set(false);
        currentOptions.onCancel?.();
      },
      onSelectionChange(state) {
        _selectionState.set(state);
        currentOptions.onSelectionChange?.(state);
      },
    });

    return handle;
  }

  function start(overrides?: Partial<AskableTextSelectionCaptureOptions>) {
    const current = ensureHandle(overrides);
    current.start();
    _active.set(true);
  }

  function captureNow(overrides?: Partial<AskableTextSelectionCaptureOptions>) {
    const current = handle ?? ensureHandle(overrides);
    const packet = current.captureNow(overrides);
    if (packet && (selectionOptions.once || overrides?.once)) {
      _active.set(false);
    }
    return packet;
  }

  function cancel() {
    handle?.cancel();
    handle = null;
    _active.set(false);
    _selectionState.set(null);
  }

  function clearSelection() {
    handle?.clearSelection();
    if (!handle) _selectionState.set(null);
  }

  function getSelection() {
    return handle?.getSelection() ?? null;
  }

  function destroy() {
    destroyCapture();
    askable.destroy();
  }

  function isActive() {
    return handle?.isActive() ?? false;
  }

  return {
    active: readonly(_active),
    lastPacket: readonly(_lastPacket),
    lastSelection: readonly(_lastSelection),
    selectionState: readonly(_selectionState),
    ctx: askable.ctx,
    start,
    captureNow,
    cancel,
    clearSelection,
    getSelection,
    destroy,
    isActive,
  };
}

// ── Viewport store ──────────────────────────────────────────────────────────

function parseViewportMeta(el: HTMLElement): Record<string, unknown> | string {
  const raw = el.dataset.askable;
  if (!raw) return '';
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return raw; }
}

function getViewportScope(el: HTMLElement, meta: Record<string, unknown> | string): string | undefined {
  if (el.dataset.askableScope) return el.dataset.askableScope;
  if (typeof meta === 'object' && meta !== null && typeof meta.scope === 'string') return meta.scope;
  return undefined;
}

function buildViewportItem(el: HTMLElement): AskableFocus {
  const meta = parseViewportMeta(el);
  return { source: 'dom', meta, scope: getViewportScope(el, meta), text: el.textContent?.trim() ?? '', element: el, timestamp: Date.now() };
}

export function createAskableViewportStore(options?: AskableViewportStoreOptions): AskableViewportStore {
  const visible = new Map<HTMLElement, AskableFocus>();
  const _visibleItems = writable<AskableFocus[]>([]);

  const promptContext = derived(_visibleItems, (items) => {
    if (!items.length) return 'No annotated elements are currently visible in the viewport.';
    const lines = items.map((item) => {
      const meta = typeof item.meta === 'string' ? item.meta : JSON.stringify(item.meta);
      const text = item.text ? ` "${item.text.slice(0, 120)}"` : '';
      return `- ${meta}${text}`;
    });
    return `Visible UI elements:\n${lines.join('\n')}`;
  });

  let intersectionObserver: IntersectionObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  const flush = () => {
    const scope = options?.scope;
    _visibleItems.set(Array.from(visible.values()).filter((item) => !scope || item.scope === scope));
  };

  function observe(root: HTMLElement = typeof document !== 'undefined' ? document.documentElement : (null as unknown as HTMLElement)) {
    if (!root || typeof IntersectionObserver === 'undefined') return;

    intersectionObserver?.disconnect();
    mutationObserver?.disconnect();
    visible.clear();

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) { visible.set(el, buildViewportItem(el)); changed = true; }
          else if (visible.has(el)) { visible.delete(el); changed = true; }
        }
        if (changed) flush();
      },
      { threshold: options?.threshold ?? 0.1 },
    );

    const observeAll = () => {
      root.querySelectorAll<HTMLElement>('[data-askable]').forEach((el) => intersectionObserver!.observe(el));
    };
    observeAll();

    mutationObserver = new MutationObserver((records) => {
      let needsReScan = false;
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const targets = node.hasAttribute('data-askable') ? [node] : Array.from(node.querySelectorAll<HTMLElement>('[data-askable]'));
          for (const el of targets) {
            if (visible.has(el)) { visible.delete(el); intersectionObserver?.unobserve(el); needsReScan = true; }
          }
        }
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && (node.hasAttribute('data-askable') || node.querySelector('[data-askable]'))) needsReScan = true;
        }
      }
      if (needsReScan) { observeAll(); flush(); }
    });
    mutationObserver.observe(root, { childList: true, subtree: true });
  }

  function destroy() {
    intersectionObserver?.disconnect();
    mutationObserver?.disconnect();
    intersectionObserver = null;
    mutationObserver = null;
    visible.clear();
    _visibleItems.set([]);
  }

  return { visibleItems: readonly(_visibleItems), promptContext, observe, destroy };
}
