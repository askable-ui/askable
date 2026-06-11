export interface AskableContextSection {
  label: string;
  value: string | null | undefined;
}

export interface UseAskableComposeOptions {
  sections: AskableContextSection[];
  separator?: string;
  emptyFallback?: string;
}

/**
 * Svelte 5 runes-based context composer.
 *
 * Pass a reactive function so Svelte tracks signal reads inside `$derived`:
 *
 * ```svelte
 * <script lang="ts">
 *   import { useAskable } from '@askable-ui/svelte/useAskable.svelte';
 *   import { useAskableCompose } from '@askable-ui/svelte/useAskableCompose.svelte';
 *
 *   const { promptContext: focusCtx } = useAskable({ observe: true });
 *   const { promptContext } = useAskableCompose(() => ({
 *     sections: [
 *       { label: 'Focused element', value: focusCtx },
 *     ],
 *   }));
 * </script>
 *
 * <p>{promptContext}</p>
 * ```
 */
export function useAskableCompose(
  options: UseAskableComposeOptions | (() => UseAskableComposeOptions),
) {
  const getOptions = typeof options === 'function' ? options : () => options;

  const promptContext = $derived.by(() => {
    const { sections, separator = '\n\n', emptyFallback = 'No UI context available.' } = getOptions();
    const active = sections
      .filter((s) => s.value != null && s.value.trim() !== '')
      .map((s) => `${s.label}:\n${s.value!.trim()}`);
    return active.length > 0 ? active.join(separator) : emptyFallback;
  });

  return { get promptContext() { return promptContext; } };
}
