import { createAskableCollectionSource } from '@askable-ui/core';
import type {
  AskableCreateCollectionSourceOptions,
  AskableContextSourceMode,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskableTableSourceOptions<TRow = unknown, TState = unknown>
  extends UseAskableSourceOptions {
  id?: string;
  /** Function returning all rows. */
  rows?: () => readonly TRow[];
  /** Function returning rows visible on screen. */
  visibleRows?: () => readonly TRow[];
  /** Function returning selected rows. */
  selectedRows?: () => readonly TRow[];
  /** Function returning table state (filters, sort, page, search). */
  state?: () => TState;
  /** Stable row identifier. */
  getRowId?: AskableCreateCollectionSourceOptions<TRow, TState>['getItemId'];
  /** Summary override. Computed from rows when omitted. */
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

export type UseAskableTableSourceResult = UseAskableSourceResult;

/**
 * Registers a table (collection) source so AI assistants can see rows,
 * selections, filters, sort state, and summary statistics.
 *
 * ```tsx
 * const rows = useSignal(allOrders);
 *
 * useAskableTableSource({
 *   id: 'orders',
 *   rows: () => rows.value,
 *   sanitizeRow: ({ id, date, amount }) => ({ id, date, amount }),
 * });
 * ```
 */
export function useAskableTableSource<TRow = unknown, TState = unknown>(
  options: UseAskableTableSourceOptions<TRow, TState> = {},
): UseAskableTableSourceResult {
  const {
    id = 'table',
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
    enabled,
    ctx,
    name,
    events,
  } = options;

  const source = createAskableCollectionSource<TRow, TState>({
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

  return useAskableSource(id, source, { enabled, ctx, name, events });
}
