import { describe, expect, it, vi, afterEach } from 'vitest';
import { ASKABLE_REGION_CAPTURE_THEME, createAskableContext, createAskableRegionCapture } from '../index.js';

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

afterEach(() => {
  document.getElementById('askable-region-capture')?.remove();
});

describe('createAskableRegionCapture', () => {
  it('captures a dragged region as a Context packet', () => {
    const ctx = createAskableContext();
    const onCapture = vi.fn();
    const capture = createAskableRegionCapture(ctx, {
      source: { app: 'dashboard' },
      intent: 'explain this region',
      onCapture,
    });

    capture.start();

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 50, 60));
    overlay.dispatchEvent(pointerEvent('pointerup', 50, 60));

    expect(onCapture).toHaveBeenCalledTimes(1);
    const [packet, selection] = onCapture.mock.calls[0];
    expect(selection).toMatchObject({
      shape: 'region',
      bounds: { x: 10, y: 20, width: 40, height: 40 },
      pointerType: 'mouse',
    });
    expect(packet).toMatchObject({
      protocol: 'askable.context',
      source: { app: 'dashboard' },
      capture: {
        mode: 'region',
        gesture: 'drag',
        intent: 'explain this region',
      },
      target: {
        bounds: { x: 10, y: 20, width: 40, height: 40 },
        metadata: {
          shape: 'region',
          pointerType: 'mouse',
        },
      },
      privacy: {
        consent: 'explicit',
      },
    });
    expect(document.getElementById('askable-region-capture')).toBeNull();

    capture.destroy();
    ctx.destroy();
  });

  it('captures a circle with center and radius metadata', () => {
    const ctx = createAskableContext();
    const onCapture = vi.fn();
    const capture = createAskableRegionCapture(ctx, {
      shape: 'circle',
      onCapture,
    });

    capture.start();

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 50, 80));
    overlay.dispatchEvent(pointerEvent('pointerup', 50, 80));

    const [packet, selection] = onCapture.mock.calls[0];
    expect(selection).toMatchObject({
      shape: 'circle',
      bounds: { x: 0, y: 20, width: 60, height: 60 },
      center: { x: 30, y: 50 },
      radius: 30,
    });
    expect(packet.capture).toMatchObject({
      mode: 'circle',
      gesture: 'circle',
    });
    expect(packet.target).toMatchObject({
      bounds: { x: 0, y: 20, width: 60, height: 60 },
      metadata: {
        shape: 'circle',
        center: { x: 30, y: 50 },
        radius: 30,
      },
    });

    capture.destroy();
    ctx.destroy();
  });

  it('captures a lasso with point metadata', () => {
    const ctx = createAskableContext();
    const onCapture = vi.fn();
    const capture = createAskableRegionCapture(ctx, {
      shape: 'lasso',
      onCapture,
    });

    capture.start();

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 30, 45));
    overlay.dispatchEvent(pointerEvent('pointermove', 70, 35));
    overlay.dispatchEvent(pointerEvent('pointerup', 80, 75));

    const [packet, selection] = onCapture.mock.calls[0];
    expect(selection).toMatchObject({
      shape: 'lasso',
      bounds: { x: 10, y: 20, width: 70, height: 55 },
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 45 },
        { x: 70, y: 35 },
        { x: 80, y: 75 },
      ],
    });
    expect(packet.capture).toMatchObject({
      mode: 'lasso',
      gesture: 'lasso',
    });
    expect(packet.target).toMatchObject({
      bounds: { x: 10, y: 20, width: 70, height: 55 },
      metadata: {
        shape: 'lasso',
        pointCount: 4,
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 45 },
          { x: 70, y: 35 },
          { x: 80, y: 75 },
        ],
      },
    });

    capture.destroy();
    ctx.destroy();
  });

  it('uses the default AI lasso theme for lasso capture', () => {
    const ctx = createAskableContext();
    const capture = createAskableRegionCapture(ctx, {
      shape: 'lasso',
      once: false,
    });

    capture.start();

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 30, 45));

    const lasso = overlay.querySelector('[data-askable-region-capture-selection="lasso"]')!;
    const gradient = lasso.querySelector('linearGradient')!;
    const polyline = lasso.querySelector('polyline')!;
    const stops = Array.from(gradient.querySelectorAll('stop')).map((stop) => ({
      offset: stop.getAttribute('offset'),
      color: stop.getAttribute('stop-color'),
    }));

    expect(overlay.style.background).toBe('rgba(15, 23, 42, 0.08)');
    expect(polyline.getAttribute('fill')).toBe('none');
    expect(polyline.getAttribute('stroke')).toBe('url(#askable-region-capture-lasso-gradient)');
    expect(polyline.getAttribute('stroke-width')).toBe('3');
    expect(polyline.style.filter).toBe('drop-shadow(0 0 8px rgba(124,58,237,0.16))');
    expect(stops).toEqual([
      ...ASKABLE_REGION_CAPTURE_THEME.lassoGradientStops.map((stop) => ({
        offset: stop.offset,
        color: stop.color,
      })),
    ]);

    capture.destroy();
    ctx.destroy();
  });

  it('keeps repeated capture handles active when once is false', () => {
    const ctx = createAskableContext();
    const onCapture = vi.fn();
    const capture = createAskableRegionCapture(ctx, {
      once: false,
      onCapture,
    });

    expect(capture.isActive()).toBe(false);

    capture.start();
    expect(capture.isActive()).toBe(true);

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 20, 30));
    overlay.dispatchEvent(pointerEvent('pointermove', 80, 90));
    overlay.dispatchEvent(pointerEvent('pointerup', 80, 90));

    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(document.getElementById('askable-region-capture')).toBe(overlay);
    expect(capture.isActive()).toBe(true);

    capture.destroy();
    expect(capture.isActive()).toBe(false);
    ctx.destroy();
  });

  it('allows consumers to theme lasso capture styling', () => {
    const ctx = createAskableContext();
    const capture = createAskableRegionCapture(ctx, {
      shape: 'lasso',
      once: false,
      theme: {
        overlayBackground: 'rgba(0,0,0,0.2)',
        lassoGradientStops: [
          { offset: '0%', color: '#111111' },
          { offset: '100%', color: '#eeeeee' },
        ],
        lassoStrokeWidth: 5,
        lassoGlowColor: 'rgba(255,0,0,0.45)',
        lassoGlowRadius: 14,
      },
    });

    capture.start();

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 30, 45));

    const lasso = overlay.querySelector('[data-askable-region-capture-selection="lasso"]')!;
    const gradient = lasso.querySelector('linearGradient')!;
    const polyline = lasso.querySelector('polyline')!;
    const stops = Array.from(gradient.querySelectorAll('stop')).map((stop) => stop.getAttribute('stop-color'));

    expect(overlay.style.background).toBe('rgba(0, 0, 0, 0.2)');
    expect(polyline.getAttribute('stroke-width')).toBe('5');
    expect(polyline.style.filter).toBe('drop-shadow(0 0 14px rgba(255,0,0,0.45))');
    expect(stops).toEqual(['#111111', '#eeeeee']);

    capture.destroy();
    ctx.destroy();
  });

  it('cancels selections smaller than the minimum size', () => {
    const ctx = createAskableContext();
    const onCapture = vi.fn();
    const onCancel = vi.fn();
    const capture = createAskableRegionCapture(ctx, {
      minSize: 12,
      onCapture,
      onCancel,
    });

    capture.start();

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointerup', 15, 24));

    expect(onCapture).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.getElementById('askable-region-capture')).toBeNull();

    capture.destroy();
    ctx.destroy();
  });

  it('cancels an active overlay with Escape', () => {
    const ctx = createAskableContext();
    const onCancel = vi.fn();
    const capture = createAskableRegionCapture(ctx, { onCancel });

    capture.start();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.getElementById('askable-region-capture')).toBeNull();

    capture.destroy();
    ctx.destroy();
  });

  it('removes the overlay before calling onCapture so an error in the callback cannot leave it mounted', () => {
    const ctx = createAskableContext();
    let overlayAtCallbackTime: HTMLElement | null | undefined;

    const capture = createAskableRegionCapture(ctx, {
      onCapture: () => {
        // Read DOM state from inside the callback to confirm cleanup already ran.
        overlayAtCallbackTime = document.getElementById('askable-region-capture');
      },
    });

    capture.start();

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 80, 90));
    overlay.dispatchEvent(pointerEvent('pointerup', 80, 90));

    expect(overlayAtCallbackTime).toBeNull();
    expect(document.getElementById('askable-region-capture')).toBeNull();

    ctx.destroy();
  });
});
