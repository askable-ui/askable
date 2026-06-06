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
  Object.defineProperty(range, 'getClientRects', {
    value: () => [bounds],
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
          rectCount: 1,
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

  it('can persist selected text affordance after capture', () => {
    const ctx = createAskableContext();
    const capture = createAskableTextSelectionCapture(ctx, {
      selectionAffordance: {
        label: 'Quoted text',
        className: 'custom-text-affordance',
        style: { opacity: '0.9' },
      },
    });

    selectText('Selected sentence.');
    capture.captureNow();

    const affordance = document.getElementById('askable-text-selection-affordance')!;
    expect(affordance).toBeInstanceOf(HTMLElement);
    expect(affordance.getAttribute('data-askable-text-selection-affordance')).toBe('true');
    expect(affordance.className).toBe('custom-text-affordance');
    expect(affordance.style.opacity).toBe('0.9');
    expect(affordance.textContent).toContain('Quoted text');
    expect(affordance.querySelectorAll('span').length).toBeGreaterThanOrEqual(2);

    capture.clearSelection();
    expect(document.getElementById('askable-text-selection-affordance')).toBeNull();

    capture.destroy();
    ctx.destroy();
  });

  it('renders an anchored selected text prompt and calls onSubmit with the captured packet', () => {
    const ctx = createAskableContext();
    const onSubmit = vi.fn();
    const capture = createAskableTextSelectionCapture(ctx, {
      source: { app: 'reader' },
      selectionAffordance: {
        prompt: {
          placeholder: 'Ask about quote',
          initialValue: 'Explain this quote',
          submitLabel: 'Send text question',
          onSubmit,
        },
      },
    });

    selectText('Explain this sentence.');
    capture.captureNow();

    const affordance = document.getElementById('askable-text-selection-affordance')!;
    const input = affordance.querySelector('input')!;
    const button = affordance.querySelector('button')!;
    expect(input.value).toBe('Explain this quote');
    expect(document.activeElement).toBe(input);
    input.value = 'What does this mean?';
    button.click();

    expect(input.placeholder).toBe('Ask about quote');
    expect(button.getAttribute('aria-label')).toBe('Send text question');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toBe('What does this mean?');
    expect(onSubmit.mock.calls[0][1]).toMatchObject({
      source: { app: 'reader' },
      capture: { mode: 'text-selection' },
      target: { text: 'Explain this sentence.' },
    });
    expect(onSubmit.mock.calls[0][2]).toMatchObject({
      text: 'Explain this sentence.',
      bounds: { x: 12, y: 20, width: 80, height: 18 },
    });
    expect(input.value).toBe('');

    capture.destroy();
    ctx.destroy();
  });

  it('keeps the selected text affordance when once stops listeners', () => {
    const ctx = createAskableContext();
    const capture = createAskableTextSelectionCapture(ctx, {
      once: true,
      selectionAffordance: true,
    });

    capture.start();
    selectText('One shot selected text.');
    const packet = capture.captureNow();

    expect(packet).not.toBeNull();
    expect(capture.isActive()).toBe(false);
    expect(document.getElementById('askable-text-selection-affordance')).toBeInstanceOf(HTMLElement);

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
