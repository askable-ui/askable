import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAskableContext, createAskableTextSelectionCapture } from '../index.js';

function selectText(
  text: string,
  bounds = { x: 12, y: 20, width: 80, height: 18 },
): HTMLElement {
  const el = document.createElement('p');
  el.id = 'selected-copy';
  el.textContent = text;
  document.body.appendChild(el);

  const node = el.firstChild!;
  const range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, text.length);
  Object.defineProperty(range, 'getBoundingClientRect', {
    value: () => bounds,
  });

  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return el;
}

function pointerEvent(type: string): PointerEvent {
  const event = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event as PointerEvent;
}

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('createAskableTextSelectionCapture', () => {
  it('captures selected text as a Context packet', () => {
    const ctx = createAskableContext();
    const onCapture = vi.fn();
    const capture = createAskableTextSelectionCapture(ctx, {
      source: { app: 'reader' },
      intent: 'explain selected text',
      onCapture,
    });

    selectText('Gross margin improved by 12%.');

    const packet = capture.captureNow();

    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(packet).toMatchObject({
      protocol: 'askable.context',
      source: { app: 'reader' },
      capture: {
        mode: 'text-selection',
        gesture: 'programmatic',
        intent: 'explain selected text',
      },
      target: {
        text: 'Gross margin improved by 12%.',
        selector: '#selected-copy',
        bounds: { x: 12, y: 20, width: 80, height: 18 },
        metadata: {
          kind: 'text-selection',
          length: 29,
        },
      },
      privacy: { consent: 'explicit' },
      provenance: {
        producer: '@askable-ui/core',
        method: 'dom',
      },
    });

    capture.destroy();
    ctx.destroy();
  });

  it('ignores selections outside the configured root', () => {
    const root = document.createElement('section');
    const outside = selectText('Outside selection');
    document.body.appendChild(root);

    const ctx = createAskableContext();
    const capture = createAskableTextSelectionCapture(ctx, { root });

    expect(outside.parentElement).toBe(document.body);
    expect(capture.captureNow()).toBeNull();

    capture.destroy();
    ctx.destroy();
  });

  it('captures debounced selectionchange events with pointer metadata', () => {
    vi.useFakeTimers();
    const ctx = createAskableContext();
    const onCapture = vi.fn();
    const capture = createAskableTextSelectionCapture(ctx, {
      debounce: 20,
      onCapture,
    });

    capture.start();
    selectText('Drag selected text');
    document.dispatchEvent(pointerEvent('pointerup'));
    vi.advanceTimersByTime(20);

    const [packet, selection] = onCapture.mock.calls[0];
    expect(selection).toMatchObject({
      text: 'Drag selected text',
      pointerType: 'mouse',
    });
    expect(packet).toMatchObject({
      capture: {
        mode: 'text-selection',
        gesture: 'drag',
      },
      target: {
        metadata: {
          pointerType: 'mouse',
        },
      },
    });

    capture.destroy();
    ctx.destroy();
  });
});
