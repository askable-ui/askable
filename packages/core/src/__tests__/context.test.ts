import { describe, it, expect, vi } from 'vitest';
import { createAskableContext } from '../index.js';

function makeEl(meta: object | string, text = 'Hello'): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-askable', typeof meta === 'string' ? meta : JSON.stringify(meta));
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement) {
  document.body.removeChild(el);
}

describe('createAskableContext', () => {
  it('returns an object with the expected methods', () => {
    const ctx = createAskableContext();
    expect(typeof ctx.observe).toBe('function');
    expect(typeof ctx.getFocus).toBe('function');
    expect(typeof ctx.on).toBe('function');
    expect(typeof ctx.off).toBe('function');
    expect(typeof ctx.toPromptContext).toBe('function');
    expect(typeof ctx.destroy).toBe('function');
    ctx.destroy();
  });

  it('getFocus() returns null before any interaction', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect(ctx.getFocus()).toBeNull();
    ctx.destroy();
  });

  it('getFocus() returns correct data after simulated click', () => {
    const meta = { widget: 'revenue', value: '$2.3M' };
    const el = makeEl(meta, 'Revenue Chart');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const focus = ctx.getFocus();
    expect(focus).not.toBeNull();
    expect(focus!.meta).toEqual(meta);
    expect(focus!.text).toBe('Revenue Chart');
    expect(typeof focus!.timestamp).toBe('number');
    expect(focus!.element).toBe(el);

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() returns the no-focus string when nothing is focused', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect(ctx.toPromptContext()).toBe('No UI element is currently focused.');
    ctx.destroy();
  });

  it('toPromptContext() returns a natural language string when focused', () => {
    const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext();
    expect(prompt).toContain('User is focused on');
    expect(prompt).toContain('churn');
    expect(prompt).toContain('4.2%');

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() supports JSON output', () => {
    const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({ format: 'json' });
    expect(JSON.parse(prompt)).toEqual({
      meta: { metric: 'churn', value: '4.2%' },
      text: 'Churn Rate',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() can omit text', () => {
    const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({ includeText: false });
    expect(prompt).toContain('metric: churn');
    expect(prompt).not.toContain('value "Churn Rate"');

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() can truncate text when requested', () => {
    const el = makeEl({ metric: 'churn' }, 'ABCDEFGHIJ');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({ maxTextLength: 5 });
    expect(prompt).toContain('value "ABCDE"');

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() can exclude keys and order keys', () => {
    const el = makeEl({ z: 1, metric: 'churn', secret: 'x', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({
      excludeKeys: ['secret'],
      keyOrder: ['metric', 'value'],
      includeText: false,
    });
    expect(prompt).toContain('metric: churn, value: 4.2%, z: 1');
    expect(prompt).not.toContain('secret');

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() returns null in JSON mode when nothing is focused', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect(ctx.toPromptContext({ format: 'json' })).toBe('null');
    ctx.destroy();
  });

  it('on("focus") calls the handler when focus changes', () => {
    const el = makeEl({ action: 'delete' }, 'Delete');
    const ctx = createAskableContext();
    ctx.observe(document);

    const handler = vi.fn();
    ctx.on('focus', handler);
    el.click();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].meta).toEqual({ action: 'delete' });

    ctx.destroy();
    cleanup(el);
  });

  it('off("focus") stops the handler from being called', () => {
    const el = makeEl({ action: 'save' }, 'Save');
    const ctx = createAskableContext();
    ctx.observe(document);

    const handler = vi.fn();
    ctx.on('focus', handler);
    el.click();
    expect(handler).toHaveBeenCalledOnce();

    ctx.off('focus', handler);
    el.click();
    expect(handler).toHaveBeenCalledOnce();

    ctx.destroy();
    cleanup(el);
  });

  it('destroy() removes all listeners and resets focus', () => {
    const el = makeEl({ section: 'header' }, 'Header');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();
    expect(ctx.getFocus()).not.toBeNull();

    const handler = vi.fn();
    ctx.on('focus', handler);
    ctx.destroy();

    el.click();
    expect(handler).not.toHaveBeenCalled();
    expect(ctx.getFocus()).toBeNull();

    cleanup(el);
  });
});
