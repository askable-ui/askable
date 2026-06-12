import { createAskableLocaleSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateLocaleSourceOptions,
  AskableLocaleSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableLocaleSourceSnapshot };

export interface UseAskableLocaleSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateLocaleSourceOptions {
  /** Source registration id. Defaults to "locale". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
}

export type UseAskableLocaleSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that exposes the user's locale, timezone,
 * date format, and currency to AI assistants.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableLocaleSource } from '@askable-ui/svelte/useAskableLocaleSource.svelte';
 *   useAskableLocaleSource();
 * </script>
 * ```
 */
export function useAskableLocaleSource(
  options: UseAskableLocaleSourceOptions = {},
): UseAskableLocaleSource {
  const {
    id = 'locale',
    ctx,
    locale,
    timezone,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const localeSource = createAskableLocaleSource({ locale, timezone, describe, kind });

  return useAskableSource(id, {
    ...localeSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });
}
