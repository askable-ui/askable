import { onMount, onDestroy } from 'svelte';
import { createAskableFocusSource, elementToFocusSnapshot } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateFocusSourceOptions,
  AskableFocusedElementSnapshot,
  AskableFocusSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableFocusedElementSnapshot, AskableFocusSourceSnapshot };

export interface UseAskableFocusSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateFocusSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "focus". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
}

export interface UseAskableFocusSource extends UseAskableSource {
  readonly snapshot: AskableFocusSourceSnapshot | null;
}

/**
 * Svelte 5 runes-based composable that tracks which element currently has
 * keyboard focus and exposes it to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableFocusSource } from '@askable-ui/svelte/useAskableFocusSource.svelte';
 *   const { snapshot } = useAskableFocusSource();
 * </script>
 * ```
 */
export function useAskableFocusSource(
  options: UseAskableFocusSourceOptions = {},
): UseAskableFocusSource {
  const {
    id = 'focus',
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let snapshot = $state<AskableFocusSourceSnapshot | null>({
    focused: null, hasFocus: false, focusChangeCount: 0, lastChangedAt: null,
  });

  let changeCount = 0;

  const focusSource = createAskableFocusSource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...focusSource, ...ctxOptions, ctx, observe, enabled });

  function handleFocusIn(e: FocusEvent): void {
    const el = e.target as Element | null;
    changeCount += 1;
    snapshot = { focused: el ? elementToFocusSnapshot(el) : null, hasFocus: el != null, focusChangeCount: changeCount, lastChangedAt: new Date().toISOString() };
    result.notifyChanged();
  }

  function handleFocusOut(): void {
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body) {
        snapshot = { ...snapshot!, focused: null, hasFocus: false, lastChangedAt: new Date().toISOString() };
        result.notifyChanged();
      }
    }, 0);
  }

  onMount(() => {
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
  });

  onDestroy(() => {
    document.removeEventListener('focusin', handleFocusIn);
    document.removeEventListener('focusout', handleFocusOut);
  });

  return { ...result, get snapshot() { return snapshot; } };
}
