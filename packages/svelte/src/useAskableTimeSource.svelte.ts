import { onMount, onDestroy } from 'svelte';
import { createAskableTimeSource, buildTimeSnapshot } from '@askable-ui/core';
import type {
  AskableContext,
  AskableBusinessHoursConfig,
  AskableCreateTimeSourceOptions,
  AskableTimeSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableBusinessHoursConfig, AskableTimeSourceSnapshot };

export interface UseAskableTimeSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateTimeSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "time". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** How often to update the snapshot in milliseconds. @default 60000 */
  intervalMs?: number;
  /** Custom business hours configuration. */
  businessHours?: AskableBusinessHoursConfig;
}

export interface UseAskableTimeSource extends UseAskableSource {
  readonly snapshot: AskableTimeSourceSnapshot | null;
}

/**
 * Svelte 5 runes-based composable that tracks the current local time, timezone,
 * and business hours status and exposes it to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableTimeSource } from '@askable-ui/svelte/useAskableTimeSource.svelte';
 *   const { snapshot } = useAskableTimeSource();
 * </script>
 * ```
 */
export function useAskableTimeSource(
  options: UseAskableTimeSourceOptions = {},
): UseAskableTimeSource {
  const {
    id = 'time',
    intervalMs = 60000,
    businessHours = {},
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const sessionStart = Date.now();
  let snapshot = $state<AskableTimeSourceSnapshot | null>(buildTimeSnapshot(businessHours, sessionStart));
  let timer: ReturnType<typeof setInterval> | null = null;

  const timeSource = createAskableTimeSource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...timeSource, ...ctxOptions, ctx, observe, enabled });

  onMount(() => {
    timer = setInterval(() => {
      snapshot = buildTimeSnapshot(businessHours, sessionStart);
      result.notifyChanged();
    }, intervalMs);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  return { ...result, get snapshot() { return snapshot; } };
}
