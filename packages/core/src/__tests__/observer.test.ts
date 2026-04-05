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

  it('detaches nested [data-askable] descendants when a subtree is removed', async () => {
    const parent = attach(makeEl({ id: 'parent' }, 'Parent'));
    const child = makeEl({ id: 'child' }, 'Child');
    const grandchild = makeEl({ id: 'grandchild' }, 'Grandchild');
    child.appendChild(grandchild);
    parent.appendChild(child);
    elements.push(child, grandchild);

    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    await new Promise((r) => setTimeout(r, 0));
    expect((obs as { boundElements: Set<HTMLElement> }).boundElements.size).toBe(3);

    parent.remove();
    await new Promise((r) => setTimeout(r, 0));

    expect((obs as { boundElements: Set<HTMLElement> }).boundElements.size).toBe(0);

    child.click();
    grandchild.click();
    expect(onFocus).not.toHaveBeenCalled();

    obs.unobserve();
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

  it('data-askable-priority: outer with higher priority wins over inner', () => {
    const outer = attach(makeEl({ level: 'outer' }, 'Outer'));
    outer.setAttribute('data-askable-priority', '10');
    const inner = makeEl({ level: 'inner' }, 'Inner');
    outer.appendChild(inner);
    elements.push(inner);

    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document);

    inner.click();

    expect(onFocus).toHaveBeenCalledOnce();
    expect((onFocus.mock.calls[0][0].meta as Record<string, unknown>).level).toBe('outer');

    obs.unobserve();
  });

  it('data-askable-priority: equal priority — inner still wins', () => {
    const outer = attach(makeEl({ level: 'outer' }, 'Outer'));
    outer.setAttribute('data-askable-priority', '5');
    const inner = makeEl({ level: 'inner' }, 'Inner');
    inner.setAttribute('data-askable-priority', '5');
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

  it('data-askable-priority: inner with higher priority still wins', () => {
    const outer = attach(makeEl({ level: 'outer' }, 'Outer'));
    outer.setAttribute('data-askable-priority', '10');
    const inner = makeEl({ level: 'inner' }, 'Inner');
    inner.setAttribute('data-askable-priority', '20');
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

  it('hover debounce: does not fire immediately', async () => {
    const el = attach(makeEl({ id: 'debounce-test' }, 'Hover'));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document, ['hover'], 50);

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(onFocus).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 60));
    expect(onFocus).toHaveBeenCalledOnce();

    obs.unobserve();
  });

  it('hover debounce: rapid hovers only fire once', async () => {
    const el = attach(makeEl({ id: 'rapid-hover' }, 'Rapid'));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document, ['hover'], 50);

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(onFocus).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 60));
    expect(onFocus).toHaveBeenCalledOnce();

    obs.unobserve();
  });

  it('hover throttle: fires immediately, then suppresses rapid repeats inside the window', async () => {
    const el = attach(makeEl({ id: 'throttle-hover' }, 'Throttle'));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document, ['hover'], 0, 50);

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(onFocus).toHaveBeenCalledOnce();

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(onFocus).toHaveBeenCalledOnce();

    await new Promise((r) => setTimeout(r, 60));
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(onFocus).toHaveBeenCalledTimes(2);

    obs.unobserve();
  });

  it('hover debounce takes precedence when debounce and throttle are both provided', async () => {
    const el = attach(makeEl({ id: 'hover-precedence' }, 'Priority'));
    const onFocus = vi.fn();
    const obs = new Observer(onFocus);
    obs.observe(document, ['hover'], 40, 5);

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(onFocus).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 50));
    expect(onFocus).toHaveBeenCalledOnce();

    obs.unobserve();
  });
});
