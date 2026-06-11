import { onCleanup, onMount } from 'solid-js';
import { createAskableFormSource } from '@askable-ui/core';
import type { AskableCreateFormSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskableFormSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateFormSourceOptions, 'form'> {
  /** Source registration id. Defaults to "form". */
  id?: string;
  /** Accessor returning the form element. Takes precedence over `selector`. */
  formRef?: () => HTMLFormElement | null | undefined;
  /** CSS selector to locate the form. Defaults to the first form in the document. */
  selector?: string;
  /** When true, notifyChanged is called automatically on input/change events. Defaults to true. */
  autoTrack?: boolean;
}

export type UseAskableFormSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that registers a form source capturing field names, values, types, labels,
 * and HTML5 validation errors so an AI assistant can provide contextual help,
 * suggest corrections, and guide users through multi-step forms.
 *
 * Passwords are masked by default. Use `omitFields` to exclude sensitive fields.
 *
 * ```tsx
 * let formRef: HTMLFormElement | undefined;
 * const { toPromptContext } = useAskableFormSource({ formRef: () => formRef });
 *
 * <form ref={formRef}>...</form>
 * <button onClick={async () => {
 *   const prompt = await toPromptContext();
 * }}>Ask AI</button>
 * ```
 */
export function useAskableFormSource(
  options: UseAskableFormSourceOptions = {},
): UseAskableFormSourceResult {
  const {
    id = 'form',
    formRef,
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

  const formSource = createAskableFormSource({
    form: formRef ?? selector,
    describe,
    kind,
    omitFields,
    maskPasswords,
    resolveLabel,
    resolveValue,
    sanitizeSnapshot,
  });

  const result = useAskableSource(id, formSource, { enabled, ctx, name, events });

  if (autoTrack) {
    onMount(() => {
      const resolveEl = () => formRef?.() ??
        (selector ? document.querySelector<HTMLFormElement>(selector) : document.querySelector<HTMLFormElement>('form'));

      const handleChange = () => result.notifyChanged();
      const form = resolveEl();
      if (!form) return;

      form.addEventListener('input', handleChange);
      form.addEventListener('change', handleChange);

      onCleanup(() => {
        form.removeEventListener('input', handleChange);
        form.removeEventListener('change', handleChange);
      });
    });
  }

  return result;
}
