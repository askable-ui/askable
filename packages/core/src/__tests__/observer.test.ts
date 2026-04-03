import { describe, it, expect, vi, afterEach } from 'vitest';
import { Observer } from '../observer.js';

function makeEl(meta: object | string, text = ''): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-askable', typeof meta === 'string' ? meta : JSON.stringify(meta));
  el.textContent = text;
  return el;
}

describe('Observer', () => {
  const elements: HTMLElement[] = [];

  afterEach(() => {
    elements.forEach((el) => el.parentNode?.removeChild(el));
    elements.length = 0;
  });

  function attach(el: HTMLElement): HTMLElement {
    document.body.appendChild(el);
    elements.push(el);
    return el;
  }

  it('detects [data-askable] elements already present at observe time', () => {
    const el = attach(makeEl({ id: 'existing' }, 'Existing'));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    el.click();
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onFocus.mock.calls[0][0].meta).toEqual({ id: 'existing' });

    obs.unobserve();
  });

  it('detects newly added [data-askable] elements via MutationObserver', async () => {
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    const el = attach(makeEl({ id: 'dynamic' }, 'Dynamic'));
    await new Promise((r) => setTimeout(r, 0));

    el.click();
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onFocus.mock.calls[0][0].meta).toEqual({ id: 'dynamic' });

    obs.unobserve();
  });

  it('parses JSON meta correctly', () => {
    const meta = { metric: 'revenue', period: 'Q3', value: 2300000 }; 
    const el = attach(makeEl(meta, 'Revenue'));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    el.click();
    expect(onFocus.mock.calls[0][0].meta).toEqual(meta);

    obs.unobserve();
  });

  it('falls back to string meta if not valid JSON', () => {
    const el = attach(makeEl('main navigation', 'Nav'));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    el.click();
    expect(onFocus.mock.calls[0][0].meta).toBe('main navigation');

    obs.unobserve();
  });

  it('extracts textContent correctly', () => {
    const el = attach(makeEl({ id: 'text-test' }, 'Hello World'));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    el.click();
    expect(onFocus.mock.calls[0][0].text).toBe('Hello World');

    obs.unobserve();
  });

  it('does not truncate textContent by default', () => {
    const longText = 'A'.repeat(300);
    const el = attach(makeEl({ id: 'truncate' }, longText));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    el.click();
    expect(onFocus.mock.calls[0][0].text).toHaveLength(300);
    expect(onFocus.mock.calls[0][0].text).toBe('A'.repeat(300));

    obs.unobserve();
  });

  it('stops triggering after unobserve()', () => {
    const el = attach(makeEl({ id: 'after-unobserve' }, 'Test'));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    el.click();
    expect(onFocus).toHaveBeenCalledOnce();

    obs.unobserve();
    el.click();
    expect(onFocus).toHaveBeenCalledOnce();
  });

  it('nested elements: innermost [data-askable] wins on click', () => {
    const outer = attach(makeEl({ level: 'outer' }, ''));
    const inner = makeEl({ level: 'inner' }, 'Inner text');
    outer.appendChild(inner);
    elements.push(inner);

    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    inner.click();

    expect(onFocus).toHaveBeenCalledOnce();
    expect((onFocus.mock.calls[0][0].meta as Record<string, unknown>).level).toBe('inner');

    obs.unobserve();
  });
});
