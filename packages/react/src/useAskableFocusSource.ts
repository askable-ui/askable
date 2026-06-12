import { useEffect, useMemo, useRef, useState } from 'react';
import { createAskableFocusSource, elementToFocusSnapshot } from '@askable-ui/core';
import type {
  AskableCreateFocusSourceOptions,
  AskableFocusedElementSnapshot,
  AskableFocusSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableFocusedElementSnapshot, AskableFocusSourceSnapshot };

export interface UseAskableFocusSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateFocusSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "focus". */
  id?: string;
}

export interface UseAskableFocusSourceResult extends UseAskableSourceResult {
  /** Current focus snapshot. */
  snapshot: AskableFocusSourceSnapshot | null;
}

/**
 * React hook that tracks which element currently has keyboard focus and exposes
 * it to AI assistants so they can provide field-specific assistance.
 *
 * @example
 * ```tsx
 * const { snapshot } = useAskableFocusSource();
 * // AI: "You're focused on the 'password' field. Use at least 8 characters."
 * ```
 */
export function useAskableFocusSource(
  options: UseAskableFocusSourceOptions = {},
): UseAskableFocusSourceResult {
  const { id = 'focus', describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = useState<AskableFocusSourceSnapshot | null>(() => ({
    focused: document.activeElement && document.activeElement !== document.body
      ? elementToFocusSnapshot(document.activeElement)
      : null,
    hasFocus: document.activeElement !== null && document.activeElement !== document.body,
    focusChangeCount: 0,
    lastChangedAt: null,
  }));

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () => createAskableFocusSource({ describe, kind, getSnapshot: () => snapshotRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });
  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  useEffect(() => {
    let changeCount = snapshotRef.current?.focusChangeCount ?? 0;

    const handleFocusIn = (e: FocusEvent) => {
      const el = e.target as Element | null;
      changeCount += 1;
      setSnapshot({
        focused: el ? elementToFocusSnapshot(el) : null,
        hasFocus: el != null,
        focusChangeCount: changeCount,
        lastChangedAt: new Date().toISOString(),
      });
      notifyRef.current();
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) {
          setSnapshot((prev) => ({
            ...(prev ?? { focusChangeCount: 0 }),
            focused: null,
            hasFocus: false,
            lastChangedAt: new Date().toISOString(),
          }));
          notifyRef.current();
        }
      }, 0);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return { ...result, snapshot };
}
