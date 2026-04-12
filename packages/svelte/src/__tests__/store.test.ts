import { describe, it, expect, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createAskableStore } from '../askable.js';

describe('createAskableStore', () => {
  const elements: HTMLElement[] = [];

  afterEach(() => {
    elements.forEach((el) => el.parentNode?.removeChild(el));
    elements.length = 0;
  });

  function makeEl(meta: object | string, text = ''): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('data-askable', typeof meta === 'string' ? meta : JSON.stringify(meta));
    el.textContent = text;
    document.body.appendChild(el);
    elements.push(el);
    return el;
  }

  it('focus store starts as null', () => {
    const store = createAskableStore();
    expect(get(store.focus)).toBeNull();
    store.destroy();
  });

  it('promptContext is the no-focus string initially', () => {
    const store = createAskableStore();
    expect(get(store.promptContext)).toBe('No UI element is currently focused.');
    store.destroy();
  });

  it('focus store updates after click on a [data-askable] element', () => {
    const el = makeEl({ metric: 'revenue', period: 'Q3' }, 'Revenue: $2.3M');
    const store = createAskableStore();

    let latestFocus: unknown = null;
    const unsub = store.focus.subscribe((f: unknown) => { latestFocus = f; });

    el.click();

    expect(latestFocus).not.toBeNull();
    expect((latestFocus as any).meta).toEqual({ metric: 'revenue', period: 'Q3' });
    expect((latestFocus as any).text).toContain('Revenue');

    unsub();
    store.destroy();
  });

  it('promptContext updates after click', () => {
    const el = makeEl({ widget: 'churn-rate' }, 'Churn: 4.2%');
    const store = createAskableStore();

    const prompts: string[] = [];
    const unsub = store.promptContext.subscribe((p: string) => prompts.push(p));

    el.click();

    const last = prompts[prompts.length - 1];
    expect(last).toContain('User is focused on');
    expect(last).toContain('churn-rate');

    unsub();
    store.destroy();
  });

  it('destroy() stops the context from tracking further focus events', () => {
    const el = makeEl({ action: 'delete' }, 'Delete');
    const store = createAskableStore();

    store.destroy();

    el.click();
    expect(get(store.focus)).toBeNull();
  });

  it('reuses the same named context across stores', () => {
    const tableA = createAskableStore({ name: 'table' });
    const tableB = createAskableStore({ name: 'table' });
    const chart = createAskableStore({ name: 'chart' });

    expect(tableA.ctx).toBe(tableB.ctx);
    expect(chart.ctx).not.toBe(tableA.ctx);

    tableA.destroy();
    tableB.destroy();
    chart.destroy();
  });

  it('accepts a scoped ctx and reflects events from it', async () => {
    const { createAskableContext } = await import('@askable-ui/core');
    const scopedCtx = createAskableContext();
    const el = makeEl({ scope: 'provided' }, 'Scoped');

    const store = createAskableStore({ ctx: scopedCtx });
    scopedCtx.observe(document.body);

    let latestFocus: unknown = null;
    const unsub = store.focus.subscribe((f: unknown) => { latestFocus = f; });

    el.click();

    expect(latestFocus).not.toBeNull();
    expect((latestFocus as any).meta).toEqual({ scope: 'provided' });

    unsub();
    // destroy() should not call ctx.destroy() when ctx is provided
    store.destroy();
    el.click(); // scopedCtx should still be alive
    expect((latestFocus as any).meta).toEqual({ scope: 'provided' });

    scopedCtx.destroy();
  });
});
