import { createAskableErrorSource } from '@askable-ui/core';
import type { AskableContext, AskableErrorEntry } from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableErrorEntry };

export interface UseAskableErrorSourceOptions extends UseAskableSourceOptions {
  /** Source registration id. Defaults to "errors". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Getter returning current errors. Accepts:
   * - `AskableErrorEntry[]`
   * - `Record<string, string | string[]>` — field → message map (VeeValidate, etc.)
   * - `Error | null`
   */
  errors?: () =>
    | readonly AskableErrorEntry[]
    | Record<string, string | string[] | undefined>
    | Error
    | null
    | undefined;
  /** Human-readable description. Defaults to "Application errors". */
  describe?: string | (() => string | Promise<string>);
  /** Source category. Defaults to "errors". */
  kind?: string;
}

export type UseAskableErrorSource = UseAskableSource;

function normalizeErrors(
  raw: readonly AskableErrorEntry[] | Record<string, string | string[] | undefined> | Error | null | undefined,
): AskableErrorEntry[] {
  if (!raw) return [];
  if (raw instanceof Error) return [{ key: raw.name ?? 'error', message: raw.message }];
  if (Array.isArray(raw)) return raw as AskableErrorEntry[];
  return Object.entries(raw as Record<string, string | string[] | undefined>)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([key, message]) => ({ key, message: message as string | string[] }));
}

/**
 * Svelte 5 runes-based composable that registers an error source exposing
 * application error state — form validation errors, API failures, caught
 * exceptions — so an AI assistant can diagnose problems.
 *
 * Compatible with VeeValidate, Zod, plain $state error objects, or any custom structure.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableErrorSource } from '@askable-ui/svelte/useAskableErrorSource.svelte';
 *
 *   let errors = $state<Record<string, string>>({});
 *   useAskableErrorSource({ errors: () => errors });
 * </script>
 * ```
 */
export function useAskableErrorSource(
  options: UseAskableErrorSourceOptions = {},
): UseAskableErrorSource {
  const {
    id = 'errors',
    ctx,
    errors,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const errorSource = createAskableErrorSource({
    describe,
    kind,
    getErrors: () => normalizeErrors(errors?.()),
  });

  const result = useAskableSource(id, {
    ...errorSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  // Auto-notify when $state-derived getters change
  $effect(() => {
    errors?.();
    result.notifyChanged();
  });

  return result;
}
