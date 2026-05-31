import { describe, expect, it, vi, afterEach } from 'vitest';
import { createAskableContext, createAskableRegionCapture } from '../index.js';

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
});
