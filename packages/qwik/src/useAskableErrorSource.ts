import { $, useSignal } from '@builder.io/qwik';
import type { QRL } from '@builder.io/qwik';
import { createAskableErrorSource } from '@askable-ui/core';
import type { AskableCreateErrorSourceOptions, AskableErrorEntry } from '@askable-ui/core';
import {
  useAskableSource,
  type UseAskableSourceOptions,
  type UseAskableSourceResult,
} from './useAskableSource.js';

export type { AskableErrorEntry };

export interface UseAskableErrorSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateErrorSourceOptions, 'describe' | 'getErrors'> {
  id?: string;
  /** Initial list of errors. Pass a QRL `getErrors` for dynamic sources. */
  initialErrors?: AskableErrorEntry[];
  /** Resume-safe description callback. */
  describe?: string | QRL<() => string | Promise<string>>;
  /** Resume-safe override for dynamic errors. */
  getErrors?: QRL<() => AskableErrorEntry[] | Promise<AskableErrorEntry[]>>;
}

export interface UseAskableErrorSourceResult extends UseAskableSourceResult {
  errors: ReturnType<typeof useSignal<AskableErrorEntry[]>>;
  addError: QRL<(entry: AskableErrorEntry) => Promise<void>>;
  removeError: QRL<(key: string) => Promise<void>>;
  clearErrors: QRL<() => Promise<void>>;
}

/**
 * Registers an error source that captures recent application errors so the AI
 * can reference them. Mutation actions are resumable QRLs.
 */
export function useAskableErrorSource(
  options: UseAskableErrorSourceOptions = {},
): UseAskableErrorSourceResult {
  const {
    id = 'errors',
    enabled,
    ctx,
    ctx$,
    name,
    events,
    viewport,
    textExtractor,
    sanitizeMeta,
    sanitizeText,
    sanitizeSource,
    maxHistory,
    describe,
    kind,
    initialErrors = [],
    getErrors: customGetErrors,
  } = options;

  const errors = useSignal<AskableErrorEntry[]>(initialErrors);
  const sourceFactory = $(async () => createAskableErrorSource({
    describe: typeof describe === 'string' ? describe : await describe?.resolve(),
    kind,
    getErrors: await customGetErrors?.resolve() ?? (() => errors.value),
  }));
  const result = useAskableSource(id, sourceFactory, {
    enabled, ctx, ctx$, name, events, viewport, textExtractor,
    sanitizeMeta, sanitizeText, sanitizeSource, maxHistory,
  });
  const notifyChanged = result.notifyChanged;

  const addError = $(async (entry: AskableErrorEntry): Promise<void> => {
    errors.value = [entry, ...errors.value.filter((errorEntry) => errorEntry.key !== entry.key)];
    await notifyChanged();
  });

  const removeError = $(async (key: string): Promise<void> => {
    errors.value = errors.value.filter((entry) => entry.key !== key);
    await notifyChanged();
  });

  const clearErrors = $(async (): Promise<void> => {
    errors.value = [];
    await notifyChanged();
  });

  return Object.assign(result, { errors, addError, removeError, clearErrors });
}
