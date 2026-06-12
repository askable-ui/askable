import { createEffect } from 'solid-js';
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
  /** Accessor returning all rows — may include rows outside the current page. */
  rows?: () => readonly TRow[];
  /** Accessor returning rows currently on screen (current page / window). */
  visibleRows?: () => readonly TRow[];
  /** Accessor returning currently selected rows. */
  selectedRows?: () => readonly TRow[];
  /** Accessor returning table state: filters, sort, page, search query etc. */
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

export type UseAskableTableSourceResult = UseAskableSourceResult;

/**
 * SolidJS primitive that registers a table (collection) source so AI assistants
 * can see rows, selections, filters, sort state, and summary statistics.
 *
 * Works with any table library — TanStack Table, plain createStore, signals.
 *
 * ```tsx
 * const [rows] = createSignal(allOrders);
 * const [selected] = createSignal<Order[]>([]);
 *
 * useAskableTableSource({
 *   id: 'orders',
 *   rows,
 *   selectedRows: selected,
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

  const result = useAskableSource(id, tableSource, { enabled, ctx, name, events });

  // Auto-notify when SolidJS signals change
  createEffect(() => {
    rows?.();
    visibleRows?.();
    selectedRows?.();
    state?.();
    result.notifyChanged();
  });

  return result;
}
