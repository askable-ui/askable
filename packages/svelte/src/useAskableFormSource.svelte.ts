import { onDestroy, onMount } from 'svelte';
import { createAskableFormSource } from '@askable-ui/core';
import type { AskableContext, AskableCreateFormSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export interface UseAskableFormSourceOptions
  extends AskableCreateFormSourceOptions,
    UseAskableSourceOptions {
  /** Source registration id. Defaults to "form". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Getter returning the form element. Takes precedence over `form` selector. */
  formRef?: () => HTMLFormElement | null | undefined;
  /** CSS selector to locate the form. Defaults to the first form in the document. */
  selector?: string;
  /** When true, notifyChanged is called automatically on input/change events. Defaults to true. */
  autoTrack?: boolean;
}

export type UseAskableFormSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that registers a form source capturing
 * field names, values, types, labels, and HTML5 validation errors so an
 * AI assistant can provide contextual help and guide users through forms.
 *
 * Passwords are masked by default. Use `omitFields` to exclude sensitive fields.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableFormSource } from '@askable-ui/svelte/useAskableFormSource.svelte';
 *
 *   let formEl: HTMLFormElement | undefined = $state();
 *   const { toPromptContext } = useAskableFormSource({ formRef: () => formEl });
 * </script>
 *
 * <form bind:this={formEl}>...</form>
 * ```
 */
export function useAskableFormSource(
  options: UseAskableFormSourceOptions = {},
): UseAskableFormSource {
  const {
    id = 'form',
    ctx,
    formRef,
    selector,
    autoTrack = true,
    observe,
    enabled,
    describe,
    kind,
    omitFields,
    maskPasswords,
    resolveLabel,
    resolveValue,
    sanitizeSnapshot,
    ...ctxOptions
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

  const result = useAskableSource(id, {
    ...formSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  if (autoTrack) {
    let cleanup: (() => void) | undefined;

    onMount(() => {
      const resolveEl = () =>
        formRef?.() ??
        (selector
          ? document.querySelector<HTMLFormElement>(selector)
          : document.querySelector<HTMLFormElement>('form'));

      const handleChange = () => result.notifyChanged();
      const form = resolveEl();
      if (!form) return;

      form.addEventListener('input', handleChange);
      form.addEventListener('change', handleChange);

      cleanup = () => {
        form.removeEventListener('input', handleChange);
        form.removeEventListener('change', handleChange);
      };
    });

    onDestroy(() => cleanup?.());
  }

  return result;
}
