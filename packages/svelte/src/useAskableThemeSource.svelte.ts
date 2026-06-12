import { createAskableThemeSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateThemeSourceOptions,
  AskableColorScheme,
  AskableContrastPreference,
  AskableMotionPreference,
  AskableThemeSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableColorScheme, AskableContrastPreference, AskableMotionPreference, AskableThemeSourceSnapshot };

export interface UseAskableThemeSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateThemeSourceOptions {
  /** Source registration id. Defaults to "theme". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Automatically register matchMedia change listeners.
   * @default true
   */
  autoTrack?: boolean;
}

export type UseAskableThemeSource = UseAskableSource;

const THEME_QUERIES = [
  '(prefers-color-scheme: dark)',
  '(prefers-color-scheme: light)',
  '(prefers-contrast: more)',
  '(prefers-contrast: less)',
  '(forced-colors: active)',
  '(prefers-reduced-motion: reduce)',
] as const;

/**
 * Svelte 5 runes-based composable that exposes the user's visual preferences
 * — dark/light mode, contrast, motion — and CSS design tokens to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableThemeSource } from '@askable-ui/svelte/useAskableThemeSource.svelte';
 *   useAskableThemeSource({ cssVars: ['--primary', '--background'] });
 * </script>
 * ```
 */
export function useAskableThemeSource(
  options: UseAskableThemeSourceOptions = {},
): UseAskableThemeSource {
  const {
    id = 'theme',
    ctx,
    autoTrack = true,
    cssVars,
    getElement,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const themeSource = createAskableThemeSource({ cssVars, getElement, describe, kind });

  const result = useAskableSource(id, {
    ...themeSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  if (autoTrack) {
    $effect(() => {
      if (typeof window === 'undefined') return;

      const notify = () => result.notifyChanged();
      const mediaLists = THEME_QUERIES.map((q) => window.matchMedia(q));
      for (const ml of mediaLists) ml.addEventListener('change', notify);
      return () => {
        for (const ml of mediaLists) ml.removeEventListener('change', notify);
      };
    });
  }

  return result;
}
