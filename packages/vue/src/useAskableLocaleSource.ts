import { type MaybeRef } from 'vue';
import { createAskableLocaleSource } from '@askable-ui/core';
import type {
  AskableCreateLocaleSourceOptions,
  AskableLocaleSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableLocaleSourceSnapshot };

export interface UseAskableLocaleSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateLocaleSourceOptions {
  /** Source registration id. Defaults to "locale". */
  id?: string;
  enabled?: MaybeRef<boolean>;
}

export type UseAskableLocaleSourceResult = UseAskableSourceResult;

/**
 * Vue composable that exposes the user's locale, timezone, date format, and
 * currency to AI assistants.
 *
 * @example
 * ```ts
 * useAskableLocaleSource();
 * ```
 */
export function useAskableLocaleSource(
  options: UseAskableLocaleSourceOptions = {},
): UseAskableLocaleSourceResult {
  const { id = 'locale', locale, timezone, describe, kind, enabled, ctx, name, events } = options;

  const source = createAskableLocaleSource({ locale, timezone, describe, kind });
  return useAskableSource(id, source, { enabled, ctx, name, events });
}
