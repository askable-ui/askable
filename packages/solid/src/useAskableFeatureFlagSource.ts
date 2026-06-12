import { createEffect } from 'solid-js';
import { createAskableFeatureFlagSource } from '@askable-ui/core';
import type {
  AskableCreateFeatureFlagSourceOptions,
  AskableFeatureFlagValue,
  AskableFeatureFlagSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableFeatureFlagValue, AskableFeatureFlagSourceSnapshot };

export interface UseAskableFeatureFlagSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateFeatureFlagSourceOptions, 'getFlags'> {
  /** Source registration id. Defaults to "feature-flags". */
  id?: string;
  /**
   * Current flag map. Accepts a plain object or a reactive accessor function.
   * Reactive signal accessors trigger automatic updates.
   */
  flags?:
    | Record<string, AskableFeatureFlagValue>
    | null
    | undefined
    | (() => Record<string, AskableFeatureFlagValue> | null | undefined);
}

export type UseAskableFeatureFlagSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that exposes feature flag state to AI assistants so they
 * can explain why features are or aren't available.
 *
 * @example
 * ```tsx
 * const [flags] = createSignal(ldClient.allFlags());
 * useAskableFeatureFlagSource({ flags });
 * ```
 */
export function useAskableFeatureFlagSource(
  options: UseAskableFeatureFlagSourceOptions = {},
): UseAskableFeatureFlagSourceResult {
  const {
    id = 'feature-flags',
    flags,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = createAskableFeatureFlagSource({
    describe,
    kind,
    getFlags: () => {
      const f = flags;
      return typeof f === 'function' ? f() : f ?? null;
    },
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  createEffect(() => {
    const f = flags;
    void (typeof f === 'function' ? f() : f);
    result.notifyChanged();
  });

  return result;
}
