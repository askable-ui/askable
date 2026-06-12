import { useState } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableTableSource } from '../useAskableTableSource.js';

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

describe('useAskableTableSource', () => {
  it('registers a table source under the "table" id by default', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableTableSource({ ctx, rows: ROWS });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('table');
      expect(resolved.id).toBe('table');
      expect(resolved.kind).toBe('table');
    });

    ctx.destroy();
  });

  it('accepts a custom id', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableTableSource({ ctx, id: 'users', rows: ROWS });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('users');
      expect(resolved.id).toBe('users');
    });

    ctx.destroy();
  });

  it('returns all rows in "all" mode', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableTableSource({ ctx, rows: ROWS });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('table', { mode: 'all' });
      const data = resolved.data as { items: Row[]; totalCount: number };
      expect(data.totalCount).toBe(3);
      expect(data.items).toHaveLength(3);
    });

    ctx.destroy();
  });

  it('returns selected rows in "selected" mode', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableTableSource({
        ctx,
        rows: ROWS,
        selectedRows: [ROWS[0], ROWS[2]],
      });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('table', { mode: 'selected' });
      const data = resolved.data as { items: Row[]; totalCount: number };
      expect(data.totalCount).toBe(2);
      expect(data.items.map((r) => r.id)).toEqual([1, 3]);
    });

    ctx.destroy();
  });

  it('returns visible rows in "visible" mode', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableTableSource({
        ctx,
        rows: ROWS,
        visibleRows: [ROWS[0]],
      });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('table', { mode: 'visible' });
      const data = resolved.data as { items: Row[] };
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe(1);
    });

    ctx.destroy();
  });

  it('applies sanitizeRow to each item', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableTableSource({
        ctx,
        rows: ROWS,
        sanitizeRow: ({ id, name }) => ({ id, name }),
      });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('table', { mode: 'all' });
      const data = resolved.data as { items: { status?: string }[] };
      expect(data.items[0].status).toBeUndefined();
    });

    ctx.destroy();
  });

  it('returns summary with counts', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableTableSource({
        ctx,
        rows: ROWS,
        visibleRows: [ROWS[0]],
        selectedRows: [],
      });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('table', { mode: 'summary' });
      const data = resolved.data as { summary: { totalRows: number; visibleRows: number } };
      expect(data.summary.totalRows).toBe(3);
      expect(data.summary.visibleRows).toBe(1);
    });

    ctx.destroy();
  });

  it('auto-notifies when rows change', async () => {
    const ctx = createAskableContext();
    const notifySpy = vi.spyOn(ctx, 'notifySourceChanged' in ctx ? ('notifySourceChanged' as any) : 'registerSource');

    function Consumer() {
      const [rows, setRows] = useState(ROWS.slice(0, 1));
      useAskableTableSource({ ctx, rows });
      return (
        <button
          onClick={() => setRows(ROWS)}
          data-testid="add"
        />
      );
    }

    const { getByTestId } = render(<Consumer />);

    await waitFor(async () => {
      const r = await ctx.resolveSource('table', { mode: 'all' });
      expect((r.data as { totalCount: number }).totalCount).toBe(1);
    });

    act(() => {
      getByTestId('add').click();
    });

    await waitFor(async () => {
      const r = await ctx.resolveSource('table', { mode: 'all' });
      expect((r.data as { totalCount: number }).totalCount).toBe(3);
    });

    ctx.destroy();
    notifySpy.mockRestore();
  });

  it('unregisters on unmount', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableTableSource({ ctx, rows: ROWS });
      return null;
    }

    const view = render(<Consumer />);

    await waitFor(async () => {
      await expect(ctx.resolveSource('table')).resolves.toMatchObject({ id: 'table' });
    });

    view.unmount();
    await expect(ctx.resolveSource('table')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('respects the enabled flag', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableTableSource({ ctx, rows: ROWS, enabled: false });
      return null;
    }

    render(<Consumer />);
    await expect(ctx.resolveSource('table')).rejects.toThrow('not registered');
    ctx.destroy();
  });
});
