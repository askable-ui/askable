import { createMemo } from 'solid-js';

export interface AskableContextSection {
  label: string;
  value: string | null | undefined;
}

export interface UseAskableComposeOptions {
  sections: AskableContextSection[];
  separator?: string;
  emptyFallback?: string;
}

export interface UseAskableComposeResult {
  promptContext: () => string;
}

/**
 * Compose multiple context streams into one prompt string.
 *
 * Pass options as a **reactive accessor** so SolidJS can track signal reads:
 *
 * ```tsx
 * const { promptContext } = useAskableCompose(() => ({
 *   sections: [
 *     { label: 'Focused element', value: focusCtx() },
 *     { label: 'Visible elements', value: viewportCtx() },
 *     { label: 'Navigation trail', value: historyCtx() },
 *   ],
 * }));
 * ```
 */
export function useAskableCompose(
  options: UseAskableComposeOptions | (() => UseAskableComposeOptions),
): UseAskableComposeResult {
  const getOptions = typeof options === 'function' ? options : () => options;

  const promptContext = createMemo(() => {
    const { sections, separator = '\n\n', emptyFallback = 'No UI context available.' } = getOptions();
    const active = sections
      .filter((s) => s.value != null && s.value.trim() !== '')
      .map((s) => `${s.label}:\n${s.value!.trim()}`);
    return active.length > 0 ? active.join(separator) : emptyFallback;
  });

  return { promptContext };
}
