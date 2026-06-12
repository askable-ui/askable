import { createEffect } from 'solid-js';
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
   * Accessor returning current errors. Accepts:
   * - `AskableErrorEntry[]`
   * - `Record<string, string | string[]>` — field → message map
   * - `Error | null`
   */
  errors?: () =>
    | readonly AskableErrorEntry[]
    | Record<string, string | string[] | undefined>
    | Error
    | null
    | undefined;
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
 * SolidJS primitive that registers an error source exposing application error state
 * so an AI assistant can diagnose problems and guide the user to resolution.
 *
 * ```tsx
 * const [errors, setErrors] = createSignal<Record<string, string>>({});
 * useAskableErrorSource({ errors });
 *
 * // Also accepts a signal returning an Error
 * const [apiError] = createSignal<Error | null>(null);
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
    getErrors: () => normalizeErrors(errors?.()),
  });

  const result = useAskableSource(id, errorSource, { enabled, ctx, name, events });

  if (errors) {
    createEffect(() => {
      errors();
      result.notifyChanged();
    });
  }

  return result;
}
