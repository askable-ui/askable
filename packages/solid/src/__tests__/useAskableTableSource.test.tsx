import { describe, it, expect } from 'vitest';
import { createSignal } from 'solid-js';
import { createAskableContext } from '@askable-ui/core';
import { useAskableTableSource } from '../useAskableTableSource.js';
import { renderHook } from '@solidjs/testing-library';

interface Row {
  id: number;
  name: string;
  status: string;
}

const ROWS: Row[] = [
  { id: 1, name: 'Alice', status: 'active' },
  { id: 2, name: 'Bob', status: 'inactive' },
  { id: 3, name: 'Carol', status: 'active' },
];

describe('useAskableTableSource (SolidJS)', () => {
  it('registers a table source under the "table" id by default', () => {
    const ctx = createAskableContext();
    const [rows] = createSignal(ROWS);

    const { result, cleanup } = renderHook(() => useAskableTableSource({ ctx, rows }));

    expect(ctx.hasSource('table')).toBe(true);
    expect(result.sourceId).toBe('table');

    cleanup();
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    const [rows] = createSignal(ROWS);

    const { result, cleanup } = renderHook(() =>
      useAskableTableSource({ ctx, id: 'users', rows }),
    );

    expect(ctx.hasSource('users')).toBe(true);
    expect(result.sourceId).toBe('users');

    cleanup();
    ctx.destroy();
  });

  it('returns all rows in "all" mode', async () => {
    const ctx = createAskableContext();
    const [rows] = createSignal(ROWS);

    const { result, cleanup } = renderHook(() => useAskableTableSource({ ctx, rows }));

    const resolved = await result.resolve({ mode: 'all' });
    const data = resolved.data as { items: Row[]; totalCount: number };
    expect(data.totalCount).toBe(3);
    expect(data.items).toHaveLength(3);

    cleanup();
    ctx.destroy();
  });

  it('returns selected rows in "selected" mode', async () => {
    const ctx = createAskableContext();
    const [rows] = createSignal(ROWS);
    const [selected] = createSignal([ROWS[0], ROWS[2]]);

    const { result, cleanup } = renderHook(() =>
      useAskableTableSource({ ctx, rows, selectedRows: selected }),
    );

    const resolved = await result.resolve({ mode: 'selected' });
    const data = resolved.data as { items: Row[] };
    expect(data.items).toHaveLength(2);
    expect(data.items.map((r) => r.id)).toEqual([1, 3]);

    cleanup();
    ctx.destroy();
  });

  it('applies sanitizeRow', async () => {
    const ctx = createAskableContext();
    const [rows] = createSignal(ROWS);

    const { result, cleanup } = renderHook(() =>
      useAskableTableSource({
        ctx,
        rows,
        sanitizeRow: ({ id, name }: Row) => ({ id, name }),
      }),
    );

    const resolved = await result.resolve({ mode: 'all' });
    const data = resolved.data as { items: { status?: string }[] };
    expect(data.items[0].status).toBeUndefined();

    cleanup();
    ctx.destroy();
  });

  it('returns summary with row counts', async () => {
    const ctx = createAskableContext();
    const [rows] = createSignal(ROWS);
    const [visible] = createSignal([ROWS[0]]);
    const [selected] = createSignal<Row[]>([]);

    const { result, cleanup } = renderHook(() =>
      useAskableTableSource({ ctx, rows, visibleRows: visible, selectedRows: selected }),
    );

    const resolved = await result.resolve({ mode: 'summary' });
    const data = resolved.data as { summary: { totalRows: number; visibleRows: number } };
    expect(data.summary.totalRows).toBe(3);
    expect(data.summary.visibleRows).toBe(1);

    cleanup();
    ctx.destroy();
  });

  it('unregisters on cleanup', () => {
    const ctx = createAskableContext();
    const [rows] = createSignal(ROWS);

    const { cleanup } = renderHook(() => useAskableTableSource({ ctx, rows }));

    expect(ctx.hasSource('table')).toBe(true);
    cleanup();
    expect(ctx.hasSource('table')).toBe(false);
    ctx.destroy();
  });
});
