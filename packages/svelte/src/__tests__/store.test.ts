import { describe, it, expect, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  createAskableRegionCaptureStore,
  createAskableSourceStore,
  createAskableStore,
  createAskableTextSelectionCaptureStore,
} from '../askable.js';

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event as PointerEvent;
}

function selectText(text: string, id = 'svelte-selection'): HTMLElement {
  const el = document.createElement('p');
  el.id = id;
  el.textContent = text;
  document.body.appendChild(el);

  const range = document.createRange();
  range.setStart(el.firstChild!, 0);
  range.setEnd(el.firstChild!, text.length);
  Object.defineProperty(range, 'getBoundingClientRect', {
    value: () => ({ x: 10, y: 15, width: 120, height: 20 }),
  });

  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return el;
}

describe('createAskableStore', () => {
  const elements: HTMLElement[] = [];

  afterEach(() => {
    elements.forEach((el) => el.parentNode?.removeChild(el));
    elements.length = 0;
    document.getElementById('askable-region-capture')?.remove();
    document.getSelection()?.removeAllRanges();
    document.querySelectorAll('#svelte-selection').forEach((el) => el.remove());
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

    const firstFocus = latestFocus;
    // destroy() should not call ctx.destroy() when ctx is provided
    store.destroy();
    scopedCtx.push({ scope: 'after-destroy' }, 'After destroy');
    expect(latestFocus).toBe(firstFocus);
    expect(scopedCtx.getFocus()?.meta).toEqual({ scope: 'after-destroy' });

    unsub();
    scopedCtx.destroy();
  });
});

describe('createAskableTextSelectionCaptureStore', () => {
  afterEach(() => {
    document.getSelection()?.removeAllRanges();
    document.querySelectorAll('#svelte-selection').forEach((el) => el.remove());
  });

  it('captures the current browser selection', () => {
    const capture = createAskableTextSelectionCaptureStore({
      source: { app: 'svelte-test' },
      intent: 'summarize selection',
    });

    selectText('Selected Svelte copy');
    const packet = capture.captureNow();

    expect(packet).toMatchObject({
      source: { app: 'svelte-test' },
      capture: {
        mode: 'text-selection',
        gesture: 'programmatic',
        intent: 'summarize selection',
      },
      target: {
        text: 'Selected Svelte copy',
        selector: '#svelte-selection',
      },
      privacy: { consent: 'explicit' },
    });
    expect(get(capture.lastPacket)).toEqual(packet);
    expect(get(capture.lastSelection)).toMatchObject({
      text: 'Selected Svelte copy',
      selector: '#svelte-selection',
    });

    capture.destroy();
  });
});

describe('createAskableSourceStore', () => {
  it('registers a source and unregisters it on destroy', async () => {
    const { createAskableContext } = await import('@askable-ui/core');
    const ctx = createAskableContext();
    const source = createAskableSourceStore('accounts', {
      kind: 'collection',
      getState: () => ({ totalCount: 2 }),
      resolve: () => ({ rows: [{ company: 'Acme' }] }),
    }, { ctx });

    await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
      id: 'accounts',
      kind: 'collection',
      state: { totalCount: 2 },
      data: { rows: [{ company: 'Acme' }] },
    });

    source.destroy();

    await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('resolves current closure values', async () => {
    const { createAskableContext } = await import('@askable-ui/core');
    const ctx = createAskableContext();
    let count = 1;
    const source = createAskableSourceStore('accounts', {
      getState: () => ({ count }),
      resolve: () => ({ count }),
    }, { ctx });

    const first = await source.resolve();
    count = 2;
    const second = await source.resolve();

    expect(first.state).toEqual({ count: 1 });
    expect(second.state).toEqual({ count: 2 });

    source.destroy();
    ctx.destroy();
  });

  it('returns a helper for serializing the registered source', async () => {
    const source = createAskableSourceStore('accounts', {
      kind: 'collection',
      resolve: ({ mode }) => ({ mode, total: 12 }),
    });

    const prompt = await source.toPromptContext({
      source: { mode: 'summary' },
    });

    expect(prompt).toContain('accounts');
    expect(prompt).toContain('"total":12');

    source.destroy();
  });

  it('notifies async subscribers when source data changes', async () => {
    const { createAskableContext } = await import('@askable-ui/core');
    const ctx = createAskableContext();
    let total = 1;
    const source = createAskableSourceStore('accounts', {
      resolve: () => ({ total }),
    }, { ctx });

    const received: string[] = [];
    ctx.subscribeAsync((context) => {
      received.push(context);
    }, {
      emitInitial: true,
      sources: ['accounts'],
    });

    await vi.waitFor(() => expect(received).toHaveLength(1));

    total = 2;
    source.notifyChanged();

    await vi.waitFor(() => {
      expect(received).toHaveLength(2);
      expect(received[1]).toContain('"total":2');
    });

    source.destroy();
    ctx.destroy();
  });

  it('can disable registration', async () => {
    const { createAskableContext } = await import('@askable-ui/core');
    const ctx = createAskableContext();
    const source = createAskableSourceStore('accounts', {
      resolve: () => ({ total: 1 }),
    }, { ctx, enabled: false });

    await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');

    source.destroy();
    ctx.destroy();
  });

  it('normalizes whitespace around ids', async () => {
    const { createAskableContext } = await import('@askable-ui/core');
    const ctx = createAskableContext();
    const source = createAskableSourceStore(' accounts ', {
      resolve: () => ({ total: 1 }),
    }, { ctx });

    await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
      id: 'accounts',
      data: { total: 1 },
    });

    source.destroy();
    ctx.destroy();
  });
});

describe('createAskableRegionCaptureStore', () => {
  afterEach(() => {
    document.getElementById('askable-region-capture')?.remove();
  });

  it('starts capture and exposes the captured packet', () => {
    const capture = createAskableRegionCaptureStore({
      source: { app: 'svelte-test' },
      intent: 'explain selected area',
    });

    capture.start();
    expect(get(capture.active)).toBe(true);

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 20, 30));
    overlay.dispatchEvent(pointerEvent('pointermove', 80, 90));
    overlay.dispatchEvent(pointerEvent('pointerup', 80, 90));

    expect(get(capture.active)).toBe(false);
    expect(get(capture.lastPacket)).toMatchObject({
      protocol: 'askable.context',
      source: { app: 'svelte-test' },
      capture: {
        mode: 'region',
        gesture: 'drag',
        intent: 'explain selected area',
      },
      target: {
        bounds: { x: 20, y: 30, width: 60, height: 60 },
        metadata: { shape: 'region', pointerType: 'mouse' },
      },
      privacy: { consent: 'explicit' },
    });

    capture.destroy();
  });

  it('supports circle capture overrides at start time', () => {
    const capture = createAskableRegionCaptureStore();

    capture.start({ shape: 'circle' });

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 50, 80));
    overlay.dispatchEvent(pointerEvent('pointerup', 50, 80));

    expect(get(capture.lastPacket)?.capture).toMatchObject({ mode: 'circle', gesture: 'circle' });
    expect(get(capture.lastSelection)).toMatchObject({
      shape: 'circle',
      bounds: { x: 0, y: 20, width: 60, height: 60 },
      center: { x: 30, y: 50 },
      radius: 30,
    });

    capture.destroy();
  });

  it('supports lasso capture overrides at start time', () => {
    const capture = createAskableRegionCaptureStore();

    capture.start({ shape: 'lasso' });

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 30, 45));
    overlay.dispatchEvent(pointerEvent('pointermove', 70, 35));
    overlay.dispatchEvent(pointerEvent('pointerup', 80, 75));

    expect(get(capture.lastPacket)?.capture).toMatchObject({ mode: 'lasso', gesture: 'lasso' });
    expect(get(capture.lastSelection)).toMatchObject({
      shape: 'lasso',
      bounds: { x: 10, y: 20, width: 70, height: 55 },
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 45 },
        { x: 70, y: 35 },
        { x: 80, y: 75 },
      ],
    });

    capture.destroy();
  });

  it('keeps store state active after capture when once is false', () => {
    const capture = createAskableRegionCaptureStore({ once: false });

    capture.start();
    expect(get(capture.active)).toBe(true);
    expect(capture.isActive()).toBe(true);

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 20, 30));
    overlay.dispatchEvent(pointerEvent('pointermove', 80, 90));
    overlay.dispatchEvent(pointerEvent('pointerup', 80, 90));

    expect(get(capture.lastPacket)).toMatchObject({
      capture: {
        mode: 'region',
        gesture: 'drag',
      },
    });
    expect(get(capture.active)).toBe(true);
    expect(capture.isActive()).toBe(true);
    expect(document.getElementById('askable-region-capture')).toBe(overlay);

    capture.destroy();
  });

  it('cancels active capture from store state', () => {
    const capture = createAskableRegionCaptureStore();

    capture.start();
    expect(get(capture.active)).toBe(true);

    capture.cancel();

    expect(get(capture.active)).toBe(false);
    expect(document.getElementById('askable-region-capture')).toBeNull();

    capture.destroy();
  });
});
