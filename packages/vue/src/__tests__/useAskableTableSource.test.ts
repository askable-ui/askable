import { describe, expect, it, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import { useAskableTableSource } from '../useAskableTableSource.js';
import { track } from './helpers.js';

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

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe('useAskableTableSource (Vue)', () => {
  it('registers a table source under the "table" id by default', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableTableSource({ ctx, rows: ref(ROWS) }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('table');
    expect(resolved.id).toBe('table');
    expect(resolved.kind).toBe('table');
    ctx.destroy();
  });

  it('returns all rows in "all" mode', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableTableSource({ ctx, rows: ref(ROWS) }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('table', { mode: 'all' });
    const data = resolved.data as { items: Row[]; totalCount: number };
    expect(data.totalCount).toBe(3);
    ctx.destroy();
  });

  it('returns selected rows in "selected" mode', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() {
        useAskableTableSource({ ctx, rows: ref(ROWS), selectedRows: ref([ROWS[0]]) });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('table', { mode: 'selected' });
    const data = resolved.data as { items: Row[] };
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe(1);
    ctx.destroy();
  });

  it('applies sanitizeRow', async () => {
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() {
        useAskableTableSource({
          ctx,
          rows: ref(ROWS),
          sanitizeRow: ({ id, name }: Row) => ({ id, name }),
        });
        return {};
      },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('table', { mode: 'all' });
    const data = resolved.data as { items: { status?: string }[] };
    expect(data.items[0].status).toBeUndefined();
    ctx.destroy();
  });

  it('unregisters on unmount', async () => {
    const ctx = createAskableContext();

    const wrapper = track(mount(defineComponent({
      setup() { useAskableTableSource({ ctx, rows: ref(ROWS) }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();
    await expect(ctx.resolveSource('table')).resolves.toMatchObject({ id: 'table' });

    wrapper.unmount();
    await expect(ctx.resolveSource('table')).rejects.toThrow('not registered');
    ctx.destroy();
  });
});
