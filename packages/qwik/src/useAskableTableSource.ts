import { createAskableTableSource } from '@askable-ui/core';
import type { AskableCreateTableSourceOptions } from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskableTableSourceOptions
  extends UseAskableSourceOptions,
    AskableCreateTableSourceOptions {
  id?: string;
}

export type UseAskableTableSourceResult = UseAskableSourceResult;

/**
 * Registers a table source that serializes visible rows, columns, sort state,
 * filters, and selection for a data grid element.
 *
 * ```tsx
 * useAskableTableSource({ selector: '#data-table', maxRows: 50 });
 * ```
 */
export function useAskableTableSource(options: UseAskableTableSourceOptions = {}): UseAskableTableSourceResult {
  const { id = 'table', enabled, ctx, name, events, ...sourceOptions } = options;
  const source = createAskableTableSource(sourceOptions);
  return useAskableSource(id, source, { enabled, ctx, name, events });
}
