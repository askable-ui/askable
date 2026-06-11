import { useMemo } from 'react';

export interface AskableContextSection {
  /** Label shown as a header in the composed context string (e.g. "Focused element"). */
  label: string;
  /** The context string for this section. Empty/null values are omitted. */
  value: string | null | undefined;
}

export interface UseAskableComposeOptions {
  /**
   * Context sections to compose. Sections with empty or null values are skipped.
   * Order is preserved in the output.
   */
  sections: AskableContextSection[];
  /**
   * String used to join sections.
   * @default "\n\n"
   */
  separator?: string;
  /**
   * String returned when all sections are empty.
   * @default "No UI context available."
   */
  emptyFallback?: string;
}

export interface UseAskableComposeResult {
  /**
   * Composed prompt context string ready for injection into any LLM system prompt.
   * Sections with empty values are automatically excluded.
   */
  promptContext: string;
}

/**
 * Compose multiple askable context sources into a single prompt string.
 *
 * Useful when you have several context streams (focus, viewport, history,
 * app data) and want one string to inject into the LLM system prompt.
 *
 * @example
 * ```tsx
 * const { focus, promptContext: focusCtx } = useAskable();
 * const { promptContext: viewportCtx } = useAskableViewport();
 * const { promptContext: historyCtx } = useAskableHistory({ maxEntries: 5 });
 *
 * const { promptContext } = useAskableCompose({
 *   sections: [
 *     { label: 'Currently focused', value: focusCtx },
 *     { label: 'Visible elements', value: viewportCtx },
 *     { label: 'Recent navigation', value: historyCtx },
 *   ],
 * });
 *
 * // → "Currently focused:\nUser is focused on: {...}\n\nVisible elements:\n..."
 * ```
 */
export function useAskableCompose(options: UseAskableComposeOptions): UseAskableComposeResult {
  const { sections, separator = '\n\n', emptyFallback = 'No UI context available.' } = options;

  const promptContext = useMemo(() => {
    const active = sections
      .filter((s) => s.value != null && s.value.trim() !== '')
      .map((s) => `${s.label}:\n${s.value!.trim()}`);

    return active.length > 0 ? active.join(separator) : emptyFallback;
  }, [sections, separator, emptyFallback]);

  return { promptContext };
}
