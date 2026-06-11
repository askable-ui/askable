import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createAskableFormSource } from '@askable-ui/core';
import type { AskableCreateFormSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskableFormSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateFormSourceOptions, 'form'> {
  /** Source registration id. Defaults to "form". */
  id?: string;
  /** Ref to the form element. Takes precedence over `selector`. */
  ref?: React.RefObject<HTMLFormElement | null>;
  /** CSS selector to locate the form. Defaults to the first form in the document. */
  selector?: string;
  /** When true, notifyChanged is called automatically on input/change events. Defaults to true. */
  autoTrack?: boolean;
}

export type UseAskableFormSourceResult = UseAskableSourceResult;

/**
 * Hook that registers a form source capturing field names, values, types, labels,
 * and HTML5 validation errors so an AI assistant can provide contextual help,
 * suggest corrections, and guide users through multi-step forms.
 *
 * Passwords are masked by default. Use `omitFields` to exclude sensitive fields.
 *
 * ```tsx
 * const formRef = useRef<HTMLFormElement>(null);
 * const { toPromptContext } = useAskableFormSource({ ref: formRef });
 *
 * // When the user clicks "Ask AI":
 * const prompt = await toPromptContext();
 * ```
 */
export function useAskableFormSource(
  options: UseAskableFormSourceOptions = {},
): UseAskableFormSourceResult {
  const {
    id = 'form',
    ref,
    selector,
    autoTrack = true,
    enabled,
    ctx,
    name,
    events,
    describe,
    kind,
    omitFields,
    maskPasswords,
    resolveLabel,
    resolveValue,
    sanitizeSnapshot,
  } = options;

  const formSource = useMemo(
    () =>
      createAskableFormSource({
        form: ref ? () => ref.current ?? undefined : selector,
        describe,
        kind,
        omitFields,
        maskPasswords,
        resolveLabel,
        resolveValue,
        sanitizeSnapshot,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selector, kind, omitFields, maskPasswords],
  );

  const result = useAskableSource(id, formSource, { enabled, ctx, name, events });

  const notifyChangedRef = useRef(result.notifyChanged);
  notifyChangedRef.current = result.notifyChanged;

  useEffect(() => {
    if (!autoTrack) return undefined;

    const resolveFormEl = () => {
      if (ref) return ref.current;
      if (selector) return document.querySelector<HTMLFormElement>(selector);
      return document.querySelector<HTMLFormElement>('form');
    };

    const handleChange = () => notifyChangedRef.current();

    const form = resolveFormEl();
    if (!form) return undefined;

    form.addEventListener('input', handleChange);
    form.addEventListener('change', handleChange);

    return () => {
      form.removeEventListener('input', handleChange);
      form.removeEventListener('change', handleChange);
    };
  }, [autoTrack, ref, selector]);

  const notifyChanged = useCallback(() => {
    result.notifyChanged();
  }, [result]);

  return { ...result, notifyChanged };
}
