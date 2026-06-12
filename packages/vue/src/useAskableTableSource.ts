import { watch, type MaybeRef, type Ref, toValue } from 'vue';
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
  rows?: MaybeRef<readonly TRow[]>;
  /** Rows currently rendered on screen (current page / virtualized window). */
  visibleRows?: MaybeRef<readonly TRow[]>;
  /** Rows currently selected by the user. */
  selectedRows?: MaybeRef<readonly TRow[]>;
  /** Table state: filters, sort column, page number, search query etc. */
  state?: MaybeRef<TState>;
  /** Stable row identifier used to resolve packet-selected ids. */
  getRowId?: AskableCreateCollectionSourceOptions<TRow, TState>['getItemId'];
  /** Summary object returned in "summary" mode. Computed from rows when omitted. */
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
  /** Accept reactive enabled ref from parent. */
  enabled?: MaybeRef<boolean>;
}

export type UseAskableTableSourceResult = UseAskableSourceResult;

/**
 * Vue composable that registers a table (collection) source so AI assistants
 * can see rows, selections, filters, sort state, and summary statistics.
 *
 * Works with any table library — TanStack Table, AG Grid, plain reactive arrays.
 *
 * ```ts
 * const { notifyChanged } = useAskableTableSource({
 *   id: 'orders',
 *   rows: allOrders,          // Ref<Order[]> or plain array
 *   visibleRows: pageOrders,  // Ref<Order[]>
 *   selectedRows: selected,   // Ref<Order[]>
 *   state: tableState,        // Ref<{ sort, filter }>
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
    getState: state !== undefined ? () => toValue(state) as TState : undefined,
    getItems: rows !== undefined ? () => toValue(rows) ?? [] : undefined,
    getVisibleItems: visibleRows !== undefined ? () => toValue(visibleRows) ?? [] : undefined,
    getSelectedItems: selectedRows !== undefined ? () => toValue(selectedRows) ?? [] : undefined,
    getItemId: getRowId,
    getSummary: getSummary ?? (rows !== undefined
      ? () => ({
          totalRows: (toValue(rows) ?? []).length,
          visibleRows: visibleRows !== undefined ? (toValue(visibleRows) ?? []).length : undefined,
          selectedRows: selectedRows !== undefined ? (toValue(selectedRows) ?? []).length : undefined,
        })
      : undefined),
    sanitizeItem: sanitizeRow ? (row) => sanitizeRow(row) : undefined,
  });

  const result = useAskableSource(id, tableSource, { enabled, ctx, name, events });

  // Auto-notify on reactive data changes
  const watchSources: Array<Ref<unknown> | MaybeRef<unknown>> = [];
  if (rows !== undefined) watchSources.push(rows as Ref<unknown>);
  if (visibleRows !== undefined) watchSources.push(visibleRows as Ref<unknown>);
  if (selectedRows !== undefined) watchSources.push(selectedRows as Ref<unknown>);
  if (state !== undefined) watchSources.push(state as Ref<unknown>);

  if (watchSources.length > 0) {
    watch(watchSources, () => result.notifyChanged(), { deep: false });
  }

  return result;
}
