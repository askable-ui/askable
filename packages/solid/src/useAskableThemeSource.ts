import { createEffect, onCleanup } from 'solid-js';
import { createAskableThemeSource } from '@askable-ui/core';
import type {
  AskableCreateThemeSourceOptions,
  AskableColorScheme,
  AskableContrastPreference,
  AskableMotionPreference,
  AskableThemeSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableColorScheme, AskableContrastPreference, AskableMotionPreference, AskableThemeSourceSnapshot };

export interface UseAskableThemeSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateThemeSourceOptions {
  /** Source registration id. Defaults to "theme". */
  id?: string;
  /**
   * Automatically register matchMedia change listeners.
   * @default true
   */
  autoTrack?: boolean;
}

export type UseAskableThemeSourceResult = UseAskableSourceResult;

const THEME_QUERIES = [
  '(prefers-color-scheme: dark)',
  '(prefers-color-scheme: light)',
  '(prefers-contrast: more)',
  '(prefers-contrast: less)',
  '(forced-colors: active)',
  '(prefers-reduced-motion: reduce)',
] as const;

/**
 * SolidJS primitive that exposes the user's visual preferences to AI assistants.
 *
 * @example
 * ```tsx
 * useAskableThemeSource({ cssVars: ['--primary', '--background'] });
 * ```
 */
export function useAskableThemeSource(
  options: UseAskableThemeSourceOptions = {},
): UseAskableThemeSourceResult {
  const {
    id = 'theme',
    autoTrack = true,
    cssVars,
    getElement,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = createAskableThemeSource({ cssVars, getElement, describe, kind });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  if (autoTrack) {
    createEffect(() => {
      if (typeof window === 'undefined') return;

      const notify = () => result.notifyChanged();
      const mediaLists = THEME_QUERIES.map((q) => window.matchMedia(q));
      for (const ml of mediaLists) ml.addEventListener('change', notify);
      onCleanup(() => {
        for (const ml of mediaLists) ml.removeEventListener('change', notify);
      });
    });
  }

  return result;
}
