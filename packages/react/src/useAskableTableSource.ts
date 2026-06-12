import { useMemo, useEffect, useRef } from 'react';
import { createAskableCollectionSource } from '@askable-ui/core';
import type {
  AskableCreateCollectionSourceOptions,
  AskableContextSourceMode,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export interface UseAskableTableSourceOptions<TRow = unknown, TState = unknown>
  extends UseAskableSourceOptions {
  /** Source registration id. Defaults to "table". */
  id?: string;
  /** All rows — may include rows outside the current page. */
  rows?: readonly TRow[];
  /** Rows currently rendered on screen (current page / virtualized window). */
  visibleRows?: readonly TRow[];
  /** Rows currently selected by the user. */
  selectedRows?: readonly TRow[];
  /** Table state: filters, sort column, page number, search query etc. */
  state?: TState | (() => TState);
  /** Stable row identifier used to resolve packet-selected ids. */
  getRowId?: AskableCreateCollectionSourceOptions<TRow, TState>['getItemId'];
  /** Summary object returned in "summary" mode. Computed from rows when omitted. */
  getSummary?: () => unknown;
  /** Maximum rows included in all/visible/selected resolutions. Defaults to 100. */
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
 * Hook that registers a table (collection) source so AI assistants can see
 * rows, selections, filters, sort state, and summary statistics.
 *
 * Works with any table library — React Table, AG Grid, plain arrays, etc.
 *
 * ```tsx
 * const { notifyChanged } = useAskableTableSource({
 *   id: 'orders',
 *   rows: allOrders,
 *   visibleRows: pageOrders,
 *   selectedRows: selectedOrders,
 *   state: { sort: 'date', filter: statusFilter },
 *   sanitizeRow: ({ id, date, amount, status }) => ({ id, date, amount, status }),
 * });
 *
 * // When the user clicks "Ask AI":
 * const { send } = useAskableAgent();
 * await send('Summarise selected orders', handler);
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

  // Keep live references to avoid stale closures in the source
  const rowsRef = useRef(rows);
  const visibleRowsRef = useRef(visibleRows);
  const selectedRowsRef = useRef(selectedRows);
  const stateRef = useRef(state);
  rowsRef.current = rows;
  visibleRowsRef.current = visibleRows;
  selectedRowsRef.current = selectedRows;
  stateRef.current = state;

  const tableSource = useMemo(
    () =>
      createAskableCollectionSource<TRow, TState>({
        kind,
        describe,
        advertisedModes,
        maxItems: maxRows,
        getState: () => {
          const s = stateRef.current;
          return typeof s === 'function' ? (s as () => TState)() : s as TState;
        },
        getItems: rowsRef.current !== undefined ? () => rowsRef.current ?? [] : undefined,
        getVisibleItems: visibleRowsRef.current !== undefined
          ? () => visibleRowsRef.current ?? []
          : undefined,
        getSelectedItems: selectedRowsRef.current !== undefined
          ? () => selectedRowsRef.current ?? []
          : undefined,
        getItemId: getRowId,
        getSummary: getSummary ?? (rowsRef.current !== undefined
          ? () => ({
              totalRows: rowsRef.current?.length ?? 0,
              visibleRows: visibleRowsRef.current?.length,
              selectedRows: selectedRowsRef.current?.length,
            })
          : undefined),
        sanitizeItem: sanitizeRow
          ? (row) => sanitizeRow(row)
          : undefined,
      }),
    // Recreate when shape of available data changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      kind,
      maxRows,
      rows !== undefined,
      visibleRows !== undefined,
      selectedRows !== undefined,
      !!getSummary,
      !!sanitizeRow,
      !!getRowId,
    ],
  );

  const result = useAskableSource(id, tableSource, { enabled, ctx, name, events });

  // Auto-notify whenever row data changes
  const notifyChangedRef = useRef(result.notifyChanged);
  notifyChangedRef.current = result.notifyChanged;

  useEffect(() => {
    notifyChangedRef.current();
  }, [rows, visibleRows, selectedRows, state]);

  return result;
}
