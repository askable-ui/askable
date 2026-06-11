import { computed } from 'vue';

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
  promptContext: ReturnType<typeof computed<string>>;
}

export function useAskableCompose(options: UseAskableComposeOptions) {
  const { separator = '\n\n', emptyFallback = 'No UI context available.' } = options;

  const promptContext = computed(() => {
    const active = options.sections
      .filter((s) => s.value != null && s.value.trim() !== '')
      .map((s) => `${s.label}:\n${s.value!.trim()}`);
    return active.length > 0 ? active.join(separator) : emptyFallback;
  });

  return { promptContext };
}
