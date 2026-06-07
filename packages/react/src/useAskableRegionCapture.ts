import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAskableRegionCapture,
  type AskableContext,
  type AskableRegionCaptureHandle,
  type AskableRegionCaptureOptions,
  type AskableRegionCaptureSelection,
  type AskableRegionCaptureState,
  type WebContextPacket,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export interface UseAskableRegionCaptureOptions
  extends AskableRegionCaptureOptions,
    Omit<UseAskableOptions, 'inspector'> {}

export interface UseAskableRegionCaptureResult {
  ctx: AskableContext;
  active: boolean;
  lastPacket: WebContextPacket | null;
  lastSelection: AskableRegionCaptureSelection | null;
  selectionState: AskableRegionCaptureState | null;
  start: (overrides?: Partial<AskableRegionCaptureOptions>) => void;
  cancel: () => void;
  clearSelection: () => void;
  getSelection: () => AskableRegionCaptureState | null;
  destroy: () => void;
  isActive: () => boolean;
}

export function useAskableRegionCapture(
  options: UseAskableRegionCaptureOptions = {},
): UseAskableRegionCaptureResult {
  const { ctx } = useAskable(options);
  const optionsRef = useRef(options);
  const handleRef = useRef<AskableRegionCaptureHandle | null>(null);
  const [active, setActive] = useState(false);
  const [lastPacket, setLastPacket] = useState<WebContextPacket | null>(null);
  const [lastSelection, setLastSelection] = useState<AskableRegionCaptureSelection | null>(null);
  const [selectionState, setSelectionState] = useState<AskableRegionCaptureState | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const destroy = useCallback(() => {
    handleRef.current?.destroy();
    handleRef.current = null;
    setActive(false);
    setSelectionState(null);
  }, []);

  const cancel = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setActive(false);
    setSelectionState(null);
  }, []);

  const clearSelection = useCallback(() => {
    handleRef.current?.clearSelection();
  }, []);

  const getSelection = useCallback(() => handleRef.current?.getSelection() ?? null, []);

  const start = useCallback((overrides?: Partial<AskableRegionCaptureOptions>) => {
    handleRef.current?.destroy();

    const currentOptions = {
      ...optionsRef.current,
      ...overrides,
    };

    const handle = createAskableRegionCapture(ctx, {
      ...currentOptions,
      onCapture(packet, selection) {
        setLastPacket(packet);
        setLastSelection(selection);
        if (currentOptions.once === false) {
          setActive(true);
        } else {
          setActive(false);
        }
        // Always read from the ref so a callback that changed since start()
        // was called still fires correctly.
        optionsRef.current.onCapture?.(packet, selection);
      },
      onSelectionChange(state) {
        setSelectionState(state);
        optionsRef.current.onSelectionChange?.(state);
      },
      onCancel() {
        setActive(false);
        optionsRef.current.onCancel?.();
      },
    });

    handleRef.current = handle;
    handle.start();
    setActive(true);
  }, [ctx]);

  const isActive = useCallback(() => handleRef.current?.isActive() ?? active, [active]);

  useEffect(() => destroy, [destroy]);

  return {
    ctx,
    active,
    lastPacket,
    lastSelection,
    selectionState,
    start,
    cancel,
    clearSelection,
    getSelection,
    destroy,
    isActive,
  };
}
