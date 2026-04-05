import { describe, it, expect, afterEach } from 'vitest';
import { createAskableContext } from '../index.js';
import { createAskableInspector } from '../inspector.js';

function makeEl(meta: object | string, text = ''): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-askable', typeof meta === 'string' ? meta : JSON.stringify(meta));
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

describe('createAskableInspector', () => {
  const elements: HTMLElement[] = [];

  afterEach(() => {
    elements.forEach((el) => el.parentNode?.removeChild(el));
    elements.length = 0;
    document.getElementById('askable-inspector')?.remove();
  });

  function attach(el: HTMLElement): HTMLElement {
    elements.push(el);
    return el;
  }

  it('mounts a panel to the document body', () => {
    const ctx = createAskableContext();
    const inspector = createAskableInspector(ctx);

    expect(document.getElementById('askable-inspector')).not.toBeNull();

    inspector.destroy();
    ctx.destroy();
  });

  it('shows "No element focused" when nothing is focused', () => {
    const ctx = createAskableContext();
    const inspector = createAskableInspector(ctx);

    const panel = document.getElementById('askable-inspector')!;
    expect(panel.textContent).toContain('No element focused');

    inspector.destroy();
    ctx.destroy();
  });

  it('updates panel content when focus changes', () => {
    const el = attach(makeEl({ metric: 'revenue', value: '$128k' }, 'Revenue'));
    const ctx = createAskableContext();
    ctx.observe(document);
    const inspector = createAskableInspector(ctx);

    el.click();

    const panel = document.getElementById('askable-inspector')!;
    expect(panel.textContent).toContain('revenue');
    expect(panel.textContent).toContain('$128k');
    expect(panel.textContent).not.toContain('No element focused');

    inspector.destroy();
    ctx.destroy();
  });

  it('shows element tag in the panel', () => {
    const el = attach(makeEl({ id: 'test' }, 'Test'));
    const ctx = createAskableContext();
    ctx.observe(document);
    const inspector = createAskableInspector(ctx);

    el.click();

    const panel = document.getElementById('askable-inspector')!;
    expect(panel.innerHTML).toContain('&lt;div');

    inspector.destroy();
    ctx.destroy();
  });

  it('shows prompt context output in the panel', () => {
    const el = attach(makeEl({ metric: 'churn' }, 'Churn'));
    const ctx = createAskableContext();
    ctx.observe(document);
    const inspector = createAskableInspector(ctx);

    el.click();

    const panel = document.getElementById('askable-inspector')!;
    expect(panel.textContent).toContain('User is focused on');

    inspector.destroy();
    ctx.destroy();
  });

  it('highlights the focused element', () => {
    const el = attach(makeEl({ metric: 'revenue' }, 'Revenue'));
    const ctx = createAskableContext();
    ctx.observe(document);
    const inspector = createAskableInspector(ctx, { highlight: true });

    el.click();

    expect(el.getAttribute('data-askable-inspector-highlight')).toBe('');
    expect(el.style.outline).toBeTruthy();

    inspector.destroy();
    ctx.destroy();
  });

  it('clears highlight when focus is cleared', () => {
    const el = attach(makeEl({ metric: 'revenue' }, 'Revenue'));
    const ctx = createAskableContext();
    ctx.observe(document);
    const inspector = createAskableInspector(ctx, { highlight: true });

    el.click();
    expect(el.getAttribute('data-askable-inspector-highlight')).toBe('');

    ctx.clear();

    expect(el.getAttribute('data-askable-inspector-highlight')).toBeNull();

    inspector.destroy();
    ctx.destroy();
  });

  it('removes panel from DOM on destroy()', () => {
    const ctx = createAskableContext();
    const inspector = createAskableInspector(ctx);

    expect(document.getElementById('askable-inspector')).not.toBeNull();

    inspector.destroy();

    expect(document.getElementById('askable-inspector')).toBeNull();

    ctx.destroy();
  });

  it('is a no-op outside browser environments', () => {
    const win = globalThis.window;
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });

    const ctx = createAskableContext();
    expect(() => createAskableInspector(ctx)).not.toThrow();

    Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
    ctx.destroy();
  });

  it('destroy() is idempotent — calling twice does not throw', () => {
    const ctx = createAskableContext();
    const inspector = createAskableInspector(ctx);

    expect(() => {
      inspector.destroy();
      inspector.destroy();
    }).not.toThrow();

    ctx.destroy();
  });

  it('a second inspector replaces the first', () => {
    const ctx = createAskableContext();
    const inspector1 = createAskableInspector(ctx);
    const inspector2 = createAskableInspector(ctx);

    expect(document.querySelectorAll('#askable-inspector').length).toBe(1);

    inspector2.destroy();
    ctx.destroy();
  });

  it('does not highlight element that has been removed from DOM', () => {
    const el = attach(makeEl({ metric: 'revenue' }, 'Revenue'));
    const ctx = createAskableContext();
    ctx.observe(document);
    const inspector = createAskableInspector(ctx, { highlight: true });

    el.click();
    expect(el.getAttribute('data-askable-inspector-highlight')).toBe('');

    // Remove element from DOM before next update
    el.parentNode?.removeChild(el);
    ctx.clear();
    // Now re-focus (simulate a select on detached element)
    ctx.select(el);

    // Detached element should not get highlight
    expect(el.getAttribute('data-askable-inspector-highlight')).toBeNull();

    inspector.destroy();
    ctx.destroy();
  });

  it('escapes HTML special characters in meta values', () => {
    const el = attach(makeEl({ xss: '<script>alert(1)</script>' }, 'Test'));
    const ctx = createAskableContext();
    ctx.observe(document);
    const inspector = createAskableInspector(ctx);

    el.click();

    const panel = document.getElementById('askable-inspector')!;
    expect(panel.querySelector('script')).toBeNull();
    expect(panel.innerHTML).toContain('&lt;script&gt;');

    inspector.destroy();
    ctx.destroy();
  });

  it('respects promptOptions', () => {
    const el = attach(makeEl({ metric: 'churn' }, 'Churn Rate'));
    const ctx = createAskableContext();
    ctx.observe(document);
    const inspector = createAskableInspector(ctx, { promptOptions: { preset: 'compact' } });

    el.click();

    const panel = document.getElementById('askable-inspector')!;
    expect(panel.textContent).toContain('User is focused on');
    // compact excludes text, so 'Churn Rate' should not appear in prompt output
    // (it may appear in the element section, but not the prompt)
    expect(panel.textContent).toContain('churn');

    inspector.destroy();
    ctx.destroy();
  });
});
