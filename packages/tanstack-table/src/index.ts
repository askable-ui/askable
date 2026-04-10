import type { AskableContext } from '@askable-ui/core';

/**
 * Minimal Row interface — compatible with `@tanstack/table-core` Row<TData>
 * without requiring the package as a hard dependency.
 */
export interface TanStackRow<TData = unknown> {
  original: TData;
  index: number;
  id: string;
}

export interface TanStackTableAdapterOptions<TData = unknown> {
  /**
   * Map a TanStack Table row to the metadata injected into the LLM context.
   *
   * @example
   * meta: (row) => ({ widget: 'users-table', rowIndex: row.index, id: row.original.id })
   */
  meta: (row: TanStackRow<TData>) => Record<string, unknown>;
  /**
   * Optional human-readable text for the row.
   * Defaults to an empty string when omitted.
   *
   * @example
   * text: (row) => `${row.original.name} — ${row.original.email}`
   */
  text?: (row: TanStackRow<TData>) => string;
}

export interface TanStackTableAdapterHandle<TData = unknown> {
  /**
   * Call this inside your row's `onClick` handler.
   *
   * @example
   * <tr onClick={() => adapter.onRowClick(row)}>
   */
  onRowClick(row: TanStackRow<TData>): void;
  /**
   * Returns props to spread onto a `<tr>` element — convenience wrapper
   * around `onRowClick` that returns `{ onClick }`.
   *
   * @example
   * <tr {...adapter.getRowProps(row)}>
   */
  getRowProps(row: TanStackRow<TData>): { onClick(): void };
}

/**
 * Create a TanStack Table adapter that drives `ctx.push()` from row interactions.
 * Use this when rendering rows with TanStack Table (including virtual mode) where
 * you cannot annotate `<tr>` elements with `data-askable`.
 *
 * @example
 * ```tsx
 * import { createTanStackTableAdapter } from '@askable-ui/tanstack-table';
 * import { useAskable } from '@askable-ui/react';
 *
 * function UsersTable({ data }) {
 *   const { ctx } = useAskable();
 *   const adapter = createTanStackTableAdapter(ctx, {
 *     meta: (row) => ({ widget: 'users-table', rowIndex: row.index, id: row.original.id }),
 *     text: (row) => `${row.original.name} — ${row.original.email}`,
 *   });
 *
 *   return (
 *     <table>
 *       <tbody>
 *         {table.getRowModel().rows.map((row) => (
 *           <tr key={row.id} {...adapter.getRowProps(row)}>
 *             {row.getVisibleCells().map((cell) => (
 *               <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
 *             ))}
 *           </tr>
 *         ))}
 *       </tbody>
 *     </table>
 *   );
 * }
 * ```
 */
export function createTanStackTableAdapter<TData = unknown>(
  ctx: AskableContext,
  options: TanStackTableAdapterOptions<TData>
): TanStackTableAdapterHandle<TData> {
  function pushRow(row: TanStackRow<TData>): void {
    ctx.push(
      options.meta(row),
      options.text ? options.text(row) : ''
    );
  }

  return {
    onRowClick(row) {
      pushRow(row);
    },
    getRowProps(row) {
      return {
        onClick() {
          pushRow(row);
        },
      };
    },
  };
}
