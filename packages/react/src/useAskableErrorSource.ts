import { useEffect, useMemo, useRef } from 'react';
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
   * - `AskableErrorEntry[]` — explicit list
   * - `Record<string, string | string[]>` — field → message map (e.g. React Hook Form `errors`)
   * - `Error` — a single caught error
   * - A function returning any of the above
   */
  errors?:
    | readonly AskableErrorEntry[]
    | Record<string, string | string[] | undefined>
    | Error
    | null
    | undefined
    | (() => readonly AskableErrorEntry[] | Record<string, string | string[]> | Error | null | undefined);
}

export type UseAskableErrorSourceResult = UseAskableSourceResult;

function normalizeErrors(
  raw:
    | readonly AskableErrorEntry[]
    | Record<string, string | string[] | undefined>
    | Error
    | null
    | undefined,
): AskableErrorEntry[] {
  if (!raw) return [];
  if (raw instanceof Error) {
    return [{ key: raw.name ?? 'error', message: raw.message }];
  }
  if (Array.isArray(raw)) return raw as AskableErrorEntry[];
  return Object.entries(raw as Record<string, string | string[] | undefined>)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([key, message]) => ({
      key,
      message: message as string | string[],
    }));
}

/**
 * Hook that registers an error source exposing application error state —
 * form validation errors, API failure messages, caught exceptions — so an
 * AI assistant can diagnose problems and guide the user to resolution.
 *
 * Compatible with React Hook Form `formState.errors`, Zod issues, try/catch
 * errors, or any custom error structure.
 *
 * ```tsx
 * // React Hook Form
 * const { register, formState: { errors } } = useForm();
 * useAskableErrorSource({ errors });
 *
 * // Manual errors
 * const [apiError, setApiError] = useState<Error | null>(null);
 * useAskableErrorSource({ errors: apiError });
 *
 * // Mixed errors object
 * useAskableErrorSource({
 *   errors: {
 *     email: 'Invalid email address',
 *     card: ['Card number is required', 'Must be 16 digits'],
 *   }
 * });
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

  const errorsRef = useRef(errors);
  errorsRef.current = errors;

  const errorSource = useMemo(
    () =>
      createAskableErrorSource({
        describe,
        kind,
        getErrors: () => {
          const raw = typeof errorsRef.current === 'function'
            ? errorsRef.current()
            : errorsRef.current;
          return normalizeErrors(raw);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind],
  );

  const result = useAskableSource(id, errorSource, { enabled, ctx, name, events });

  const notifyChangedRef = useRef(result.notifyChanged);
  notifyChangedRef.current = result.notifyChanged;

  // Notify on every errors prop change so state is always fresh
  useEffect(() => {
    notifyChangedRef.current();
  }, [errors]);

  return result;
}
