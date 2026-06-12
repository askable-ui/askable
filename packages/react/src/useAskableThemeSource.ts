import { useEffect, useMemo } from 'react';
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
   * Automatically register `matchMedia` change listeners for dark mode,
   * contrast, and motion preferences.
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
 * React hook that exposes the user's visual preferences — dark/light mode,
 * contrast level, motion preference, and active CSS design tokens — so AI
 * assistants can tailor responses about UI appearance and accessibility.
 *
 * @example
 * ```tsx
 * useAskableThemeSource({
 *   cssVars: ['--primary', '--background', '--radius'],
 * });
 *
 * // AI now knows: "Color scheme: dark, custom --primary: #6366f1"
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

  const source = useMemo(
    () => createAskableThemeSource({ cssVars, getElement, describe, kind }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  useEffect(() => {
    if (!autoTrack || typeof window === 'undefined') return;

    const notify = () => result.notifyChanged();
    const mediaLists = THEME_QUERIES.map((q) => window.matchMedia(q));

    for (const ml of mediaLists) ml.addEventListener('change', notify);
    return () => {
      for (const ml of mediaLists) ml.removeEventListener('change', notify);
    };
  }, [autoTrack, result]);

  return result;
}
