import { useMemo } from 'react';
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
 * React hook that exposes the user's locale, timezone, date format, currency,
 * and hour cycle to AI assistants — so the AI can correctly format dates, times,
 * and currencies for the user's region.
 *
 * @example
 * ```tsx
 * useAskableLocaleSource();
 *
 * // AI now knows: "Locale: en-US, Timezone: America/New_York (UTC-05:00), Currency: USD"
 * ```
 */
export function useAskableLocaleSource(
  options: UseAskableLocaleSourceOptions = {},
): UseAskableLocaleSourceResult {
  const {
    id = 'locale',
    locale,
    timezone,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = useMemo(
    () => createAskableLocaleSource({ locale, timezone, describe, kind }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return useAskableSource(id, source, { enabled, ctx, name, events });
}
