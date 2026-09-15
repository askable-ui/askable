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
    focused: null,
    hasFocus: false,
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
    if (typeof document === 'undefined') return;

    const doc = document;
    let changeCount = snapshotRef.current?.focusChangeCount ?? 0;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;

    const updateSnapshot = (next: AskableFocusSourceSnapshot) => {
      snapshotRef.current = next;
      setSnapshot(next);
      notifyRef.current();
    };

    const cancelBlur = () => {
      if (blurTimer !== undefined) clearTimeout(blurTimer);
      blurTimer = undefined;
    };

    const active = doc.activeElement;
    const focused = active && active !== doc.body ? active : null;
    updateSnapshot({
      focused: focused ? elementToFocusSnapshot(focused) : null,
      hasFocus: focused !== null,
      focusChangeCount: changeCount,
      lastChangedAt: snapshotRef.current?.lastChangedAt ?? null,
    });

    const handleFocusIn = (e: FocusEvent) => {
      cancelBlur();
      const el = e.target as Element | null;
      changeCount += 1;
      updateSnapshot({
        focused: el ? elementToFocusSnapshot(el) : null,
        hasFocus: el != null,
        focusChangeCount: changeCount,
        lastChangedAt: new Date().toISOString(),
      });
    };

    const handleFocusOut = () => {
      cancelBlur();
      blurTimer = setTimeout(() => {
        blurTimer = undefined;
        const active = doc.activeElement;
        if (!active || active === doc.body) {
          updateSnapshot({
            focusChangeCount: changeCount,
            focused: null,
            hasFocus: false,
            lastChangedAt: new Date().toISOString(),
          });
        }
      }, 0);
    };

    doc.addEventListener('focusin', handleFocusIn);
    doc.addEventListener('focusout', handleFocusOut);

    return () => {
      cancelBlur();
      doc.removeEventListener('focusin', handleFocusIn);
      doc.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return { ...result, snapshot };
}
