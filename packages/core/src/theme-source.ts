import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export type AskableColorScheme = 'dark' | 'light' | 'no-preference' | 'unknown';
export type AskableContrastPreference = 'more' | 'less' | 'forced' | 'no-preference' | 'unknown';
export type AskableMotionPreference = 'reduce' | 'no-preference' | 'unknown';

export interface AskableThemeSourceSnapshot {
  /** User's preferred color scheme (dark/light/no-preference). */
  colorScheme: AskableColorScheme;
  /** Whether dark mode is active. */
  isDark: boolean;
  /** Whether light mode is active. */
  isLight: boolean;
  /** User's contrast preference. */
  contrastPreference: AskableContrastPreference;
  /** User's motion preference (for animations). */
  motionPreference: AskableMotionPreference;
  /** Whether the user prefers reduced motion. */
  prefersReducedMotion: boolean;
  /**
   * Active CSS custom property values (if `cssVars` option is provided).
   * e.g. { '--primary': '#6366f1', '--radius': '0.5rem' }
   */
  cssVars: Record<string, string>;
}

export interface AskableCreateThemeSourceOptions {
  /**
   * CSS custom property names to read from :root and include in the snapshot.
   * @example ['--primary', '--background', '--radius']
   */
  cssVars?: string[];
  /**
   * Element to read CSS variables from. Defaults to `document.documentElement`.
   */
  getElement?: () => Element | null;
  /** Custom describe function. */
  describe?: (snapshot: AskableThemeSourceSnapshot) => string;
  /** Source category. Defaults to "theme". */
  kind?: string;
}

function matchMedia(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(query)?.matches;
}

function buildSnapshot(options: AskableCreateThemeSourceOptions): AskableThemeSourceSnapshot {
  const isDark = matchMedia('(prefers-color-scheme: dark)');
  const isLight = matchMedia('(prefers-color-scheme: light)');
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const moreContrast = matchMedia('(prefers-contrast: more)');
  const lessContrast = matchMedia('(prefers-contrast: less)');
  const forcedColors = matchMedia('(forced-colors: active)');

  const colorScheme: AskableColorScheme = isDark ? 'dark' : isLight ? 'light' : 'no-preference';

  const contrastPreference: AskableContrastPreference = forcedColors
    ? 'forced'
    : moreContrast
      ? 'more'
      : lessContrast
        ? 'less'
        : 'no-preference';

  const motionPreference: AskableMotionPreference = prefersReducedMotion ? 'reduce' : 'no-preference';

  const cssVars: Record<string, string> = {};
  if (options.cssVars?.length) {
    const el = options.getElement?.() ?? (typeof document !== 'undefined' ? document.documentElement : null);
    if (el) {
      const style = window.getComputedStyle(el);
      for (const v of options.cssVars) {
        const value = style.getPropertyValue(v).trim();
        if (value) cssVars[v] = value;
      }
    }
  }

  return {
    colorScheme,
    isDark,
    isLight,
    contrastPreference,
    motionPreference,
    prefersReducedMotion,
    cssVars,
  };
}

function defaultDescribe(snapshot: AskableThemeSourceSnapshot): string {
  const lines: string[] = [];

  lines.push(`Color scheme: ${snapshot.colorScheme}`);

  if (snapshot.contrastPreference !== 'no-preference') {
    lines.push(`Contrast preference: ${snapshot.contrastPreference}`);
  }
  if (snapshot.prefersReducedMotion) {
    lines.push('Motion preference: reduced (disable animations)');
  }
  if (Object.keys(snapshot.cssVars).length > 0) {
    lines.push('CSS theme variables:');
    for (const [k, v] of Object.entries(snapshot.cssVars)) {
      lines.push(`  ${k}: ${v}`);
    }
  }

  return lines.join('\n');
}

/**
 * Creates a theme context source that exposes the user's visual preferences —
 * dark/light mode, contrast level, motion preference, and active CSS design tokens —
 * so AI assistants can tailor responses about UI appearance, accessibility, and
 * component design to the user's actual environment.
 *
 * @example
 * ```ts
 * const source = createAskableThemeSource({
 *   cssVars: ['--primary', '--background', '--radius'],
 * });
 * ctx.registerSource('theme', source);
 *
 * // Auto-notify when dark mode changes
 * window.matchMedia('(prefers-color-scheme: dark)')
 *   .addEventListener('change', () => handle.notifyChanged());
 * ```
 */
export function createAskableThemeSource(
  options: AskableCreateThemeSourceOptions = {},
): AskableContextSource {
  const { describe, kind = 'theme' } = options;

  return createAskableSource({
    kind,
    describe: describe
      ? () => describe(buildSnapshot(options))
      : () => defaultDescribe(buildSnapshot(options)),
    state: () => {
      const s = buildSnapshot(options);
      return {
        colorScheme: s.colorScheme,
        isDark: s.isDark,
        prefersReducedMotion: s.prefersReducedMotion,
      };
    },
    data: () => buildSnapshot(options),
  });
}
