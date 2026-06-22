import { createAskableFormSource } from '@askable-ui/core';
import type { AskableCreateFormSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskableFormSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateFormSourceOptions {
  id?: string;
}

export type UseAskableFormSourceResult = UseAskableSourceResult;

/**
 * Registers a form source that serializes field values and validation state
 * for a given `<form>` element.
 *
 * ```tsx
 * export const ContactForm = component$(() => {
 *   useAskableFormSource({ selector: '#contact-form' });
 *   // ...
 * });
 * ```
 */
export function useAskableFormSource(options: UseAskableFormSourceOptions = {}): UseAskableFormSourceResult {
  const { id = 'form', enabled, ctx, name, events, ...sourceOptions } = options;
  const source = createAskableFormSource(sourceOptions);
  return useAskableSource(id, source, { enabled, ctx, name, events });
}
