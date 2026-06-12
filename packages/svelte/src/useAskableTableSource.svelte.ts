import { createAskableCollectionSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateCollectionSourceOptions,
  AskableContextSourceMode,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export interface UseAskableTableSourceOptions<TRow = unknown, TState = unknown>
  extends UseAskableSourceOptions {
  /** Source registration id. Defaults to "table". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Getter returning all rows — may include rows outside the current page. */
  rows?: () => readonly TRow[];
  /** Getter returning rows currently on screen (current page / window). */
  visibleRows?: () => readonly TRow[];
  /** Getter returning currently selected rows. */
  selectedRows?: () => readonly TRow[];
  /** Getter returning table state: filters, sort, page, search query etc. */
  state?: () => TState;
  /** Stable row identifier used to resolve packet-selected ids. */
  getRowId?: AskableCreateCollectionSourceOptions<TRow, TState>['getItemId'];
  /** Summary returned in "summary" mode. Computed from rows when omitted. */
  getSummary?: () => unknown;
  /** Maximum rows included in resolutions. Defaults to 100. */
  maxRows?: number;
  /** Redact or transform each row before serialization. */
  sanitizeRow?: (row: TRow) => unknown;
  /** Human-readable description. Defaults to "Data table". */
  describe?: string | (() => string | Promise<string>);
  /** Source category. Defaults to "table". */
  kind?: string;
  /** Additional modes to advertise. */
  advertisedModes?: readonly AskableContextSourceMode[];
}

export type UseAskableTableSource = UseAskableSource;

/**
 * Svelte 5 runes-based composable that registers a table (collection) source
 * so AI assistants can see rows, selections, filters, sort state, and summaries.
 *
 * Works with any table library — TanStack Table, plain $state arrays, svelte-query.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableTableSource } from '@askable-ui/svelte/useAskableTableSource.svelte';
 *
 *   let rows = $state(allOrders);
 *   let selected = $state<Order[]>([]);
 *
 *   useAskableTableSource({
 *     rows: () => rows,
 *     selectedRows: () => selected,
 *     sanitizeRow: ({ id, date, amount }) => ({ id, date, amount }),
 *   });
 * </script>
 * ```
 */
export function useAskableTableSource<TRow = unknown, TState = unknown>(
  options: UseAskableTableSourceOptions<TRow, TState> = {},
): UseAskableTableSource {
  const {
    id = 'table',
    ctx,
    rows,
    visibleRows,
    selectedRows,
    state,
    getRowId,
    getSummary,
    maxRows = 100,
    sanitizeRow,
    describe = 'Data table',
    kind = 'table',
    advertisedModes,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const tableSource = createAskableCollectionSource<TRow, TState>({
    kind,
    describe,
    advertisedModes,
    maxItems: maxRows,
    getState: state,
    getItems: rows,
    getVisibleItems: visibleRows,
    getSelectedItems: selectedRows,
    getItemId: getRowId,
    getSummary: getSummary ?? (rows
      ? () => ({
          totalRows: rows().length,
          visibleRows: visibleRows?.().length,
          selectedRows: selectedRows?.().length,
        })
      : undefined),
    sanitizeItem: sanitizeRow ? (row) => sanitizeRow(row) : undefined,
  });

  const result = useAskableSource(id, {
    ...tableSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  // Auto-notify when $state-derived getters change
  $effect(() => {
    rows?.();
    visibleRows?.();
    selectedRows?.();
    state?.();
    result.notifyChanged();
  });

  return result;
}
