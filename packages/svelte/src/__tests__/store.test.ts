import { describe, it, expect, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createAskableRegionCaptureStore, createAskableStore } from '../askable.js';

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

describe('createAskableStore', () => {
  const elements: HTMLElement[] = [];

  afterEach(() => {
    elements.forEach((el) => el.parentNode?.removeChild(el));
    elements.length = 0;
    document.getElementById('askable-region-capture')?.remove();
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
