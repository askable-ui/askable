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
}

export type UseAskableLocaleSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that exposes the user's locale, timezone, date format, and
 * currency to AI assistants.
 *
 * @example
 * ```tsx
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
