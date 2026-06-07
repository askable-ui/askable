import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAskableTextSelectionCapture,
  type AskableContext,
  type AskableTextSelectionCaptureHandle,
  type AskableTextSelectionCaptureOptions,
  type AskableTextSelectionCaptureSelection,
  type AskableTextSelectionCaptureState,
  type WebContextPacket,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export interface UseAskableTextSelectionCaptureOptions
  extends AskableTextSelectionCaptureOptions,
    Omit<UseAskableOptions, 'inspector'> {}

export interface UseAskableTextSelectionCaptureResult {
  ctx: AskableContext;
  active: boolean;
  lastPacket: WebContextPacket | null;
  lastSelection: AskableTextSelectionCaptureSelection | null;
  start: (overrides?: Partial<AskableTextSelectionCaptureOptions>) => void;
  captureNow: (overrides?: Partial<AskableTextSelectionCaptureOptions>) => WebContextPacket | null;
  cancel: () => void;
  clearSelection: () => void;
  getSelection: () => AskableTextSelectionCaptureState | null;
  destroy: () => void;
  isActive: () => boolean;
}

export function useAskableTextSelectionCapture(
  options: UseAskableTextSelectionCaptureOptions = {},
): UseAskableTextSelectionCaptureResult {
  const { ctx } = useAskable(options);
  const optionsRef = useRef(options);
  const handleRef = useRef<AskableTextSelectionCaptureHandle | null>(null);
  const [active, setActive] = useState(false);
  const [lastPacket, setLastPacket] = useState<WebContextPacket | null>(null);
  const [lastSelection, setLastSelection] = useState<AskableTextSelectionCaptureSelection | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const destroy = useCallback(() => {
    handleRef.current?.destroy();
    handleRef.current = null;
    setActive(false);
  }, []);

  const cancel = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setActive(false);
  }, []);

  const clearSelection = useCallback(() => {
    handleRef.current?.clearSelection();
  }, []);

  const getSelection = useCallback(() => handleRef.current?.getSelection() ?? null, []);

  const ensureHandle = useCallback((overrides?: Partial<AskableTextSelectionCaptureOptions>) => {
    const currentOptions = {
      ...optionsRef.current,
      ...overrides,
    };

    handleRef.current?.destroy();
    const handle = createAskableTextSelectionCapture(ctx, {
      ...currentOptions,
      onCapture(packet, selection) {
        setLastPacket(packet);
        setLastSelection(selection);
        if (currentOptions.once) {
          setActive(false);
        }
        optionsRef.current.onCapture?.(packet, selection);
      },
      onCancel() {
        handleRef.current = null;
        setActive(false);
        optionsRef.current.onCancel?.();
      },
    });

    handleRef.current = handle;
    return handle;
  }, [ctx]);

  const start = useCallback((overrides?: Partial<AskableTextSelectionCaptureOptions>) => {
    const handle = ensureHandle(overrides);
    handle.start();
    setActive(true);
  }, [ensureHandle]);

  const captureNow = useCallback((overrides?: Partial<AskableTextSelectionCaptureOptions>) => {
    const handle = handleRef.current ?? ensureHandle(overrides);
    const packet = handle.captureNow(overrides);
    if (packet && (optionsRef.current.once || overrides?.once)) {
      setActive(false);
    }
    return packet;
  }, [ensureHandle]);

  const isActive = useCallback(() => handleRef.current?.isActive() ?? active, [active]);

  useEffect(() => destroy, [destroy]);

  return {
    ctx,
    active,
    lastPacket,
    lastSelection,
    start,
    captureNow,
    cancel,
    clearSelection,
    getSelection,
    destroy,
    isActive,
  };
}
