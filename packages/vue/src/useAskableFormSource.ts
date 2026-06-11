import { onMounted, onUnmounted, type MaybeRef, type Ref } from 'vue';
import { createAskableFormSource } from '@askable-ui/core';
import type { AskableCreateFormSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskableFormSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateFormSourceOptions, 'form'> {
  /** Source registration id. Defaults to "form". */
  id?: string;
  /** Template ref to the form element. Takes precedence over `selector`. */
  formRef?: Ref<HTMLFormElement | null | undefined>;
  /** CSS selector to locate the form. Defaults to the first form in the document. */
  selector?: string;
  /** When true, notifyChanged is called automatically on input/change events. Defaults to true. */
  autoTrack?: MaybeRef<boolean>;
  /** Accept reactive enabled ref from parent. */
  enabled?: MaybeRef<boolean>;
}

export type UseAskableFormSourceResult = UseAskableSourceResult;

/**
 * Vue composable that registers a form source capturing field names, values, types, labels,
 * and HTML5 validation errors so an AI assistant can provide contextual help,
 * suggest corrections, and guide users through multi-step forms.
 *
 * Passwords are masked by default. Use `omitFields` to exclude sensitive fields.
 *
 * ```ts
 * const formRef = ref<HTMLFormElement>();
 * const { toPromptContext } = useAskableFormSource({ formRef });
 *
 * async function askAI() {
 *   const prompt = await toPromptContext();
 *   // send to your LLM
 * }
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
    form: formRef ? () => formRef.value ?? undefined : selector,
    describe,
    kind,
    omitFields,
    maskPasswords,
    resolveLabel,
    resolveValue,
    sanitizeSnapshot,
  });

  const result = useAskableSource(id, formSource, { enabled, ctx, name, events });

  const handleChange = () => result.notifyChanged();

  onMounted(() => {
    const track = typeof autoTrack === 'boolean' ? autoTrack : autoTrack.valueOf();
    if (!track) return;

    const form = formRef?.value ?? (selector
      ? document.querySelector<HTMLFormElement>(selector)
      : document.querySelector<HTMLFormElement>('form'));
    if (!form) return;

    form.addEventListener('input', handleChange);
    form.addEventListener('change', handleChange);
  });

  onUnmounted(() => {
    const form = formRef?.value ?? (selector
      ? document.querySelector<HTMLFormElement>(selector)
      : document.querySelector<HTMLFormElement>('form'));
    if (!form) return;

    form.removeEventListener('input', handleChange);
    form.removeEventListener('change', handleChange);
  });

  return result;
}
