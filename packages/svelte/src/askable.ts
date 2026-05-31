import { writable, derived, readonly } from 'svelte/store';
import {
  createAskableContext,
  createAskableInspector,
  createAskableRegionCapture,
  createAskableTextSelectionCapture,
} from '@askable-ui/core';
import type {
  AskableEvent,
  AskableFocus,
  AskableContext,
  AskableInspectorOptions,
  AskableContextOptions,
  AskableRegionCaptureHandle,
  AskableRegionCaptureOptions,
  AskableRegionCaptureSelection,
  AskableTextSelectionCaptureHandle,
  AskableTextSelectionCaptureOptions,
  AskableTextSelectionCaptureSelection,
  WebContextPacket,
} from '@askable-ui/core';

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
  ctx: AskableContext;
  start: (overrides?: Partial<AskableRegionCaptureOptions>) => void;
  cancel: () => void;
  destroy: () => void;
  isActive: () => boolean;
}

export interface AskableTextSelectionCaptureStoreOptions extends AskableStoreOptions, AskableTextSelectionCaptureOptions {}

export interface AskableTextSelectionCaptureStore {
  active: ReturnType<typeof readonly>;
  lastPacket: ReturnType<typeof readonly>;
  lastSelection: ReturnType<typeof readonly>;
  ctx: AskableContext;
  start: (overrides?: Partial<AskableTextSelectionCaptureOptions>) => void;
  captureNow: (overrides?: Partial<AskableTextSelectionCaptureOptions>) => WebContextPacket | null;
  cancel: () => void;
  destroy: () => void;
  isActive: () => boolean;
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

export function createAskableRegionCaptureStore(
  options: AskableRegionCaptureStoreOptions = {},
): AskableRegionCaptureStore {
  const { ctx, name, events, inspector, ...regionOptions } = options;
  const askable = createAskableStore({ ctx, name, events, inspector });
  const _active = writable(false);
  const _lastPacket = writable<WebContextPacket | null>(null);
  const _lastSelection = writable<AskableRegionCaptureSelection | null>(null);
  let handle: AskableRegionCaptureHandle | null = null;

  function destroyCapture() {
    handle?.destroy();
    handle = null;
    _active.set(false);
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
        handle = null;
        _active.set(false);
        currentOptions.onCapture?.(packet, selection);
      },
      onCancel() {
        handle = null;
        _active.set(false);
        currentOptions.onCancel?.();
      },
    });

    handle.start();
    _active.set(true);
  }

  function cancel() {
    handle?.cancel();
    handle = null;
    _active.set(false);
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
    ctx: askable.ctx,
    start,
    cancel,
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
  let handle: AskableTextSelectionCaptureHandle | null = null;

  function destroyCapture() {
    handle?.destroy();
    handle = null;
    _active.set(false);
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
          handle = null;
          _active.set(false);
        }
        currentOptions.onCapture?.(packet, selection);
      },
      onCancel() {
        handle = null;
        _active.set(false);
        currentOptions.onCancel?.();
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
      handle = null;
      _active.set(false);
    }
    return packet;
  }

  function cancel() {
    handle?.cancel();
    handle = null;
    _active.set(false);
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
    ctx: askable.ctx,
    start,
    captureNow,
    cancel,
    destroy,
    isActive,
  };
}
