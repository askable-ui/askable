import { watch, type MaybeRef, toValue } from 'vue';
import { createAskableErrorSource } from '@askable-ui/core';
import type { AskableCreateErrorSourceOptions, AskableErrorEntry } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableErrorEntry };

export interface UseAskableErrorSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateErrorSourceOptions, 'getErrors'> {
  /** Source registration id. Defaults to "errors". */
  id?: string;
  /**
   * Current errors. Accepts:
   * - `Ref<AskableErrorEntry[]>` or plain array
   * - `Ref<Record<string, string | string[]>>` — field → message map
   * - `Ref<Error | null>` — a caught error
   */
  errors?: MaybeRef<
    | readonly AskableErrorEntry[]
    | Record<string, string | string[] | undefined>
    | Error
    | null
    | undefined
  >;
  /** Accept reactive enabled ref from parent. */
  enabled?: MaybeRef<boolean>;
}

export type UseAskableErrorSourceResult = UseAskableSourceResult;

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
 * Vue composable that registers an error source exposing application error state —
 * form validation errors, API failure messages, caught exceptions — so an AI
 * assistant can diagnose problems and guide the user to resolution.
 *
 * Compatible with VeeValidate, Zod, plain reactive error objects, or any custom structure.
 *
 * ```ts
 * // With reactive errors object
 * const errors = ref<Record<string, string>>({});
 * useAskableErrorSource({ errors });
 *
 * // With a caught Error
 * const apiError = ref<Error | null>(null);
 * useAskableErrorSource({ errors: apiError });
 * ```
 */
export function useAskableErrorSource(
  options: UseAskableErrorSourceOptions = {},
): UseAskableErrorSourceResult {
  const {
    id = 'errors',
    errors,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const errorSource = createAskableErrorSource({
    describe,
    kind,
    getErrors: () => normalizeErrors(toValue(errors)),
  });

  const result = useAskableSource(id, errorSource, { enabled, ctx, name, events });

  if (errors !== undefined) {
    watch(() => toValue(errors), () => result.notifyChanged(), { deep: true });
  }

  return result;
}
