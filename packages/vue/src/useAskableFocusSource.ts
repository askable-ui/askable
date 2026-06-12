import { ref, onMounted, onUnmounted, type MaybeRef } from 'vue';
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
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableFocusSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableFocusSourceSnapshot | null>>;
}

/**
 * Vue composable that tracks which element currently has keyboard focus and
 * exposes it to AI assistants so they can provide field-specific assistance.
 *
 * @example
 * ```ts
 * const { snapshot } = useAskableFocusSource();
 * ```
 */
export function useAskableFocusSource(
  options: UseAskableFocusSourceOptions = {},
): UseAskableFocusSourceResult {
  const { id = 'focus', describe, kind, enabled, ctx, name, events } = options;

  const snapshot = ref<AskableFocusSourceSnapshot | null>({
    focused: null, hasFocus: false, focusChangeCount: 0, lastChangedAt: null,
  });

  const source = createAskableFocusSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let changeCount = 0;

  function handleFocusIn(e: FocusEvent): void {
    const el = e.target as Element | null;
    changeCount += 1;
    snapshot.value = { focused: el ? elementToFocusSnapshot(el) : null, hasFocus: el != null, focusChangeCount: changeCount, lastChangedAt: new Date().toISOString() };
    result.notifyChanged();
  }

  function handleFocusOut(): void {
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body) {
        snapshot.value = { ...snapshot.value!, focused: null, hasFocus: false, lastChangedAt: new Date().toISOString() };
        result.notifyChanged();
      }
    }, 0);
  }

  onMounted(() => {
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
  });

  onUnmounted(() => {
    document.removeEventListener('focusin', handleFocusIn);
    document.removeEventListener('focusout', handleFocusOut);
  });

  return { ...result, snapshot };
}
