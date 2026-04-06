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
    expect(typeof (ctx as any).serializeFocus).toBe('function');
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

  it('serializeFocus() returns null when nothing is focused', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect((ctx as any).serializeFocus()).toBeNull();
    ctx.destroy();
  });

  it('serializeFocus() returns structured focused data', () => {
    const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    expect((ctx as any).serializeFocus()).toEqual({
      meta: { metric: 'churn', value: '4.2%' },
      text: 'Churn Rate',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
    cleanup(el);
  });

  it('serializeFocus() respects includeText and maxTextLength', () => {
    const el = makeEl({ metric: 'churn' }, 'ABCDEFGHIJ');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    expect((ctx as any).serializeFocus({ includeText: false })).toEqual({
      meta: { metric: 'churn' },
      timestamp: expect.any(Number),
    });

    expect((ctx as any).serializeFocus({ maxTextLength: 5 })).toEqual({
      meta: { metric: 'churn' },
      text: 'ABCDE',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
    cleanup(el);
  });

  it('serializeFocus() respects excludeKeys and keyOrder', () => {
    const el = makeEl({ z: 1, metric: 'churn', secret: 'x', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    expect((ctx as any).serializeFocus({
      excludeKeys: ['secret'],
      keyOrder: ['metric', 'value'],
      includeText: false,
    })).toEqual({
      meta: { metric: 'churn', value: '4.2%', z: 1 },
      timestamp: expect.any(Number),
    });

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

  it('getHistory() returns focuses in newest-first order', () => {
    const el1 = makeEl({ id: 'a' }, 'A');
    const el2 = makeEl({ id: 'b' }, 'B');
    const el3 = makeEl({ id: 'c' }, 'C');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();
    el3.click();

    const history = ctx.getHistory();
    expect(history).toHaveLength(3);
    expect((history[0].meta as Record<string, unknown>).id).toBe('c');
    expect((history[1].meta as Record<string, unknown>).id).toBe('b');
    expect((history[2].meta as Record<string, unknown>).id).toBe('a');

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
    cleanup(el3);
  });

  it('getHistory() respects the limit argument', () => {
    const el1 = makeEl({ id: 'a' }, 'A');
    const el2 = makeEl({ id: 'b' }, 'B');
    const el3 = makeEl({ id: 'c' }, 'C');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();
    el3.click();

    const history = ctx.getHistory(2);
    expect(history).toHaveLength(2);
    expect((history[0].meta as Record<string, unknown>).id).toBe('c');

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
    cleanup(el3);
  });

  it('clear() resets focus to null and emits clear event', () => {
    const el = makeEl({ widget: 'chart' }, 'Chart');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();
    expect(ctx.getFocus()).not.toBeNull();

    const clearHandler = vi.fn();
    ctx.on('clear', clearHandler);
    ctx.clear();

    expect(ctx.getFocus()).toBeNull();
    expect(clearHandler).toHaveBeenCalledOnce();
    expect(clearHandler.mock.calls[0][0]).toBeNull();

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() truncates output when maxTokens is exceeded', () => {
    // meta value long enough to exceed a small token budget
    const longMeta = { description: 'A'.repeat(200) };
    const el = makeEl(longMeta, '');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({ maxTokens: 10 });
    expect(prompt).toContain('[truncated]');
    expect(prompt.length).toBeLessThanOrEqual(10 * 4);

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() does not truncate when output fits within maxTokens', () => {
    const el = makeEl({ x: 1 }, 'short');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const full = ctx.toPromptContext();
    const prompt = ctx.toPromptContext({ maxTokens: 1000 });
    expect(prompt).toBe(full);

    ctx.destroy();
    cleanup(el);
  });

  it('toHistoryContext() returns no-history string when empty', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect(ctx.toHistoryContext()).toBe('No interaction history.');
    ctx.destroy();
  });

  it('toHistoryContext() serializes history newest-first with numbered entries', () => {
    const el1 = makeEl({ id: 'a' }, 'A');
    const el2 = makeEl({ id: 'b' }, 'B');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();

    const history = ctx.toHistoryContext();
    const lines = history.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\[1\]/);
    expect(lines[0]).toContain('id: b');
    expect(lines[1]).toMatch(/^\[2\]/);
    expect(lines[1]).toContain('id: a');

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
  });

  it('toHistoryContext() respects limit', () => {
    const el1 = makeEl({ id: 'a' }, 'A');
    const el2 = makeEl({ id: 'b' }, 'B');
    const el3 = makeEl({ id: 'c' }, 'C');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();
    el3.click();

    const history = ctx.toHistoryContext(2);
    const lines = history.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('id: c');

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
    cleanup(el3);
  });

  it('toHistoryContext() respects serialization options', () => {
    const el = makeEl({ metric: 'mrr', secret: 'x' }, 'MRR');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const history = ctx.toHistoryContext(undefined, { excludeKeys: ['secret'], includeText: false });
    expect(history).toContain('mrr');
    expect(history).not.toContain('secret');
    expect(history).not.toContain('MRR');

    ctx.destroy();
    cleanup(el);
  });

  it('toHistoryContext() truncates when maxTokens exceeded', () => {
    const el1 = makeEl({ id: 'a', description: 'A'.repeat(100) }, 'A');
    const el2 = makeEl({ id: 'b', description: 'B'.repeat(100) }, 'B');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();

    const history = ctx.toHistoryContext(undefined, { maxTokens: 10 });
    expect(history).toContain('[truncated]');
    expect(history.length).toBeLessThanOrEqual(10 * 4);

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
  });

  describe('preset option', () => {
    it('compact preset omits text and uses natural format', () => {
      const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const prompt = ctx.toPromptContext({ preset: 'compact' });
      expect(prompt).toContain('User is focused on');
      expect(prompt).toContain('metric: churn');
      expect(prompt).not.toContain('Churn Rate');

      ctx.destroy();
      cleanup(el);
    });

    it('verbose preset includes text and uses natural format', () => {
      const el = makeEl({ metric: 'churn' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const prompt = ctx.toPromptContext({ preset: 'verbose' });
      expect(prompt).toContain('User is focused on');
      expect(prompt).toContain('Churn Rate');

      ctx.destroy();
      cleanup(el);
    });

    it('json preset returns JSON with text', () => {
      const el = makeEl({ metric: 'churn' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const prompt = ctx.toPromptContext({ preset: 'json' });
      const parsed = JSON.parse(prompt);
      expect(parsed.meta).toEqual({ metric: 'churn' });
      expect(parsed.text).toBe('Churn Rate');

      ctx.destroy();
      cleanup(el);
    });

    it('individual options override the preset', () => {
      const el = makeEl({ metric: 'churn' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      // compact sets includeText: false, but we override it to true
      const prompt = ctx.toPromptContext({ preset: 'compact', includeText: true });
      expect(prompt).toContain('Churn Rate');

      ctx.destroy();
      cleanup(el);
    });

    it('serializeFocus() respects preset', () => {
      const el = makeEl({ metric: 'churn' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const serialized = (ctx as any).serializeFocus({ preset: 'compact' });
      expect(serialized.text).toBeUndefined();

      ctx.destroy();
      cleanup(el);
    });

    it('toHistoryContext() respects preset', () => {
      const el = makeEl({ metric: 'mrr' }, 'MRR');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const history = ctx.toHistoryContext(undefined, { preset: 'compact' });
      expect(history).toContain('mrr');
      expect(history).not.toContain('MRR');

      ctx.destroy();
      cleanup(el);
    });
  });

  describe('textExtractor option', () => {
    it('uses custom text extractor when provided', () => {
      const el = makeEl({ metric: 'revenue' }, 'Original text');
      el.setAttribute('aria-label', 'Custom label');
      const ctx = createAskableContext({
        textExtractor: (e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '',
      });
      ctx.observe(document);
      el.click();

      const focus = ctx.getFocus();
      expect(focus?.text).toBe('Custom label');

      ctx.destroy();
      cleanup(el);
    });

    it('uses default text extraction when no extractor provided', () => {
      const el = makeEl({ metric: 'revenue' }, 'Default text');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const focus = ctx.getFocus();
      expect(focus?.text).toBe('Default text');

      ctx.destroy();
      cleanup(el);
    });

    it('select() uses custom text extractor', () => {
      const el = makeEl({ metric: 'revenue' }, 'Original text');
      el.setAttribute('aria-label', 'Select label');
      const ctx = createAskableContext({
        textExtractor: (e) => e.getAttribute('aria-label') ?? '',
      });

      ctx.select(el);

      const focus = ctx.getFocus();
      expect(focus?.text).toBe('Select label');

      ctx.destroy();
      cleanup(el);
    });
  });

  describe('data-askable-text element-level override', () => {
    it('uses data-askable-text instead of textContent', () => {
      const el = makeEl({ metric: 'revenue' }, 'Raw text content');
      el.setAttribute('data-askable-text', 'Custom override');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      expect(ctx.getFocus()?.text).toBe('Custom override');
      ctx.destroy();
      cleanup(el);
    });

    it('empty data-askable-text suppresses text', () => {
      const el = makeEl({ metric: 'revenue' }, 'Sensitive content');
      el.setAttribute('data-askable-text', '');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      expect(ctx.getFocus()?.text).toBe('');
      ctx.destroy();
      cleanup(el);
    });

    it('data-askable-text takes priority over textExtractor', () => {
      const el = makeEl({ metric: 'revenue' }, 'Original');
      el.setAttribute('aria-label', 'ARIA label');
      el.setAttribute('data-askable-text', 'Element override');
      const ctx = createAskableContext({
        textExtractor: (e) => e.getAttribute('aria-label') ?? '',
      });
      ctx.observe(document);
      el.click();

      expect(ctx.getFocus()?.text).toBe('Element override');
      ctx.destroy();
      cleanup(el);
    });

    it('select() respects data-askable-text', () => {
      const el = makeEl({ metric: 'revenue' }, 'Original');
      el.setAttribute('data-askable-text', 'Selected override');
      const ctx = createAskableContext();
      ctx.select(el);

      expect(ctx.getFocus()?.text).toBe('Selected override');
      ctx.destroy();
      cleanup(el);
    });
  });

  describe('sanitizeMeta and sanitizeText options', () => {
    it('sanitizeMeta strips sensitive fields from object meta', () => {
      const el = makeEl({ metric: 'revenue', password: 'secret', value: '$2M' }, 'Revenue');
      const ctx = createAskableContext({
        sanitizeMeta: ({ password, ...safe }) => safe,
      });
      ctx.observe(document);
      el.click();

      const focus = ctx.getFocus();
      expect((focus!.meta as Record<string, unknown>).password).toBeUndefined();
      expect((focus!.meta as Record<string, unknown>).metric).toBe('revenue');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitizeMeta is reflected in toPromptContext()', () => {
      const el = makeEl({ metric: 'revenue', password: 'secret' }, 'Revenue');
      const ctx = createAskableContext({
        sanitizeMeta: ({ password, ...safe }) => safe,
      });
      ctx.observe(document);
      el.click();

      const prompt = ctx.toPromptContext();
      expect(prompt).not.toContain('password');
      expect(prompt).not.toContain('secret');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitizeMeta does not apply to string meta', () => {
      const el = makeEl('plain string meta', 'Text');
      const sanitize = vi.fn((m: Record<string, unknown>) => m);
      const ctx = createAskableContext({ sanitizeMeta: sanitize });
      ctx.observe(document);
      el.click();

      expect(sanitize).not.toHaveBeenCalled();
      expect(ctx.getFocus()!.meta).toBe('plain string meta');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitizeText masks text content', () => {
      const el = makeEl({ item: 'card' }, '4111 1111 1111 1111');
      const ctx = createAskableContext({
        sanitizeText: (text) => text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[card]'),
      });
      ctx.observe(document);
      el.click();

      expect(ctx.getFocus()!.text).toBe('[card]');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitizers apply to select() as well', () => {
      const el = makeEl({ metric: 'revenue', secret: 'x' }, 'Raw text');
      const ctx = createAskableContext({
        sanitizeMeta: ({ secret, ...safe }) => safe,
        sanitizeText: (t) => t.toUpperCase(),
      });

      ctx.select(el);

      const focus = ctx.getFocus();
      expect((focus!.meta as Record<string, unknown>).secret).toBeUndefined();
      expect(focus!.text).toBe('RAW TEXT');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitized data is reflected in history and events', () => {
      const el = makeEl({ metric: 'revenue', pin: '1234' }, 'Text');
      const ctx = createAskableContext({
        sanitizeMeta: ({ pin, ...safe }) => safe,
      });
      ctx.observe(document);

      const handler = vi.fn();
      ctx.on('focus', handler);
      el.click();

      expect((handler.mock.calls[0][0].meta as Record<string, unknown>).pin).toBeUndefined();
      expect((ctx.getHistory()[0].meta as Record<string, unknown>).pin).toBeUndefined();

      ctx.destroy();
      cleanup(el);
    });
  });

  it('observe() is a no-op when called outside a browser environment', () => {
    const win = globalThis.window;
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });

    const ctx = createAskableContext();
    expect(() => ctx.observe(document)).not.toThrow();
    expect(ctx.getFocus()).toBeNull();

    Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
    ctx.destroy();
  });
});
