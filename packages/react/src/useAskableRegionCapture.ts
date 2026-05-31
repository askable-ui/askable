import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAskableRegionCapture,
  type AskableContext,
  type AskableRegionCaptureHandle,
  type AskableRegionCaptureOptions,
  type AskableRegionCaptureSelection,
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
  start: (overrides?: Partial<AskableRegionCaptureOptions>) => void;
  cancel: () => void;
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
          handleRef.current = null;
          setActive(false);
        }
        currentOptions.onCapture?.(packet, selection);
      },
      onCancel() {
        setActive(false);
        currentOptions.onCancel?.();
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
    start,
    cancel,
    destroy,
    isActive,
  };
}
