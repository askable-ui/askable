import type { AskableContext } from '@askable-ui/core';

/**
 * Parameters passed to the `meta` and `text` callbacks for each row event.
 */
export interface AgGridRowParams<TData = unknown> {
  /** The row data object */
  data: TData;
  /** Zero-based row index in the current rendered order */
  rowIndex: number;
  /** Column ID, only set for cell-level events like `onCellFocused` */
  colId?: string;
}

export interface AgGridAdapterOptions<TData = unknown> {
  /**
   * Map a row to the metadata injected into the LLM context.
   * Keep values small — only what the AI needs to understand the row.
   *
   * @example
   * meta: ({ data, rowIndex }) => ({
   *   widget: 'deals-table',
   *   rowIndex,
   *   id: data.id,
   *   stage: data.stage,
   * })
   */
  meta: (params: AgGridRowParams<TData>) => Record<string, unknown>;
  /**
   * Optional human-readable text for the row, used as the `text` field in the focus entry.
   * Defaults to an empty string when omitted.
   *
   * @example
   * text: ({ data }) => `${data.company} — ${data.stage} — ${data.value}`
   */
  text?: (params: AgGridRowParams<TData>) => string;
}

export interface AgGridAdapterHandle<TData = unknown> {
  /**
   * Wire to `gridOptions.onRowClicked` or `<AgGridReact onRowClicked={...} />`.
   * Fires when the user clicks any cell in a row.
   */
  onRowClicked(params: { data: TData; rowIndex: number }): void;
  /**
   * Wire to `gridOptions.onCellFocused` or `<AgGridReact onCellFocused={...} />`.
   * Fires when the user moves keyboard focus to a cell.
   *
   * Requires the AG Grid API to look up the row node by index.
   */
  onCellFocused(params: {
    rowIndex: number | null;
    column: { getColId(): string } | null;
    api: { getRowNode(rowIndex: number): { data: TData } | null };
  }): void;
  /**
   * Wire to `gridOptions.onRowSelected` or `<AgGridReact onRowSelected={...} />`.
   * Only pushes context when the row becomes selected (not deselected).
   */
  onRowSelected(params: {
    data: TData;
    rowIndex: number;
    node: { isSelected(): boolean };
  }): void;
}

/**
 * Create an AG Grid adapter that drives `ctx.push()` from AG Grid's own event
 * callbacks. Use this when you cannot annotate AG Grid rows with `data-askable`
 * because AG Grid renders its own internal DOM.
 *
 * @example
 * ```tsx
 * import { createAgGridAdapter } from '@askable-ui/ag-grid';
 * import { useAskable } from '@askable-ui/react';
 *
 * function DealsTable({ rows }) {
 *   const { ctx } = useAskable();
 *   const adapter = createAgGridAdapter(ctx, {
 *     meta: ({ data, rowIndex }) => ({ widget: 'deals-table', rowIndex, id: data.id }),
 *     text: ({ data }) => `${data.company} — ${data.stage} — ${data.value}`,
 *   });
 *
 *   return (
 *     <AgGridReact
 *       rowData={rows}
 *       onRowClicked={adapter.onRowClicked}
 *       onCellFocused={adapter.onCellFocused}
 *     />
 *   );
 * }
 * ```
 */
export function createAgGridAdapter<TData = unknown>(
  ctx: AskableContext,
  options: AgGridAdapterOptions<TData>
): AgGridAdapterHandle<TData> {
  function pushRow(params: AgGridRowParams<TData>): void {
    ctx.push(
      options.meta(params),
      options.text ? options.text(params) : ''
    );
  }

  return {
    onRowClicked(params) {
      pushRow({ data: params.data, rowIndex: params.rowIndex });
    },

    onCellFocused(params) {
      if (params.rowIndex === null) return;
      const node = params.api.getRowNode(params.rowIndex);
      if (!node) return;
      pushRow({
        data: node.data,
        rowIndex: params.rowIndex,
        colId: params.column?.getColId(),
      });
    },

    onRowSelected(params) {
      if (!params.node.isSelected()) return;
      pushRow({ data: params.data, rowIndex: params.rowIndex });
    },
  };
}
