import { useSignal } from '@builder.io/qwik';
import { createAskableErrorSource } from '@askable-ui/core';
import type { AskableCreateErrorSourceOptions, AskableErrorEntry } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableErrorEntry };

export interface UseAskableErrorSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateErrorSourceOptions, 'getErrors'> {
  id?: string;
  /** Initial list of errors. Pass `getErrors` for dynamic sources. */
  initialErrors?: AskableErrorEntry[];
  /** Override the error getter with a custom async function. */
  getErrors?: AskableCreateErrorSourceOptions['getErrors'];
}

export interface UseAskableErrorSourceResult extends UseAskableSourceResult {
  errors: ReturnType<typeof useSignal<AskableErrorEntry[]>>;
  addError(entry: AskableErrorEntry): void;
  removeError(key: string): void;
  clearErrors(): void;
}

/**
 * Registers an error source that captures recent application errors so the AI
 * can reference them. Errors are managed reactively via `addError`/`removeError`.
 *
 * ```tsx
 * const { addError } = useAskableErrorSource();
 * // On catch: addError({ key: 'submit', message: 'Network timeout', severity: 'error' });
 * ```
 */
export function useAskableErrorSource(options: UseAskableErrorSourceOptions = {}): UseAskableErrorSourceResult {
  const { id = 'errors', enabled, ctx, name, events, describe, kind, initialErrors = [], getErrors: customGetErrors } = options;

  const errors = useSignal<AskableErrorEntry[]>(initialErrors);

  const source = createAskableErrorSource({
    describe,
    kind,
    getErrors: customGetErrors ?? (() => errors.value),
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function addError(entry: AskableErrorEntry): void {
    errors.value = [entry, ...errors.value.filter((e) => e.key !== entry.key)];
    result.notifyChanged();
  }

  function removeError(key: string): void {
    errors.value = errors.value.filter((e) => e.key !== key);
    result.notifyChanged();
  }

  function clearErrors(): void {
    errors.value = [];
    result.notifyChanged();
  }

  return { ...result, errors, addError, removeError, clearErrors };
}
