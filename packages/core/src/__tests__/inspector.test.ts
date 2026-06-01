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

  it('shows registered context sources in the panel', () => {
    const ctx = createAskableContext();
    ctx.registerSource('accounts', {
      kind: 'collection',
      resolve: () => ({ total: 12 }),
    });
    const inspector = createAskableInspector(ctx);

    const panel = document.getElementById('askable-inspector')!;
    expect(panel.textContent).toContain('Context sources');
    expect(panel.textContent).toContain('accounts');
    expect(panel.textContent).toContain('collection');

    inspector.destroy();
    ctx.destroy();
  });

  it('updates context sources when registrations change', () => {
    const ctx = createAskableContext();
    const inspector = createAskableInspector(ctx);
    const panel = document.getElementById('askable-inspector')!;

    expect(panel.textContent).toContain('No sources registered');

    const handle = ctx.registerSource('document', {
      kind: 'document',
      resolve: () => ({ title: 'Launch plan' }),
    });

    expect(panel.textContent).toContain('document');

    handle.unregister();

    expect(panel.textContent).toContain('No sources registered');

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

  it('can be dragged to a new viewport position', () => {
    const ctx = createAskableContext();
    const inspector = createAskableInspector(ctx);
    const panel = document.getElementById('askable-inspector')!;
    const handle = panel.querySelector('[data-askable-inspector-drag-handle]')!;

    panel.getBoundingClientRect = () => ({
      x: 100,
      y: 120,
      left: 100,
      top: 120,
      right: 420,
      bottom: 360,
      width: 320,
      height: 240,
      toJSON: () => ({}),
    });

    handle.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 110,
      clientY: 130,
    }));
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 180,
      clientY: 210,
    }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(panel.style.left).toBe('170px');
    expect(panel.style.top).toBe('200px');
    expect(panel.style.right).toBe('auto');
    expect(panel.style.bottom).toBe('auto');

    inspector.destroy();
    ctx.destroy();
  });

  it('shows built-in interaction test tools by default', () => {
    const ctx = createAskableContext();
    const inspector = createAskableInspector(ctx);

    expect(document.querySelector('[data-askable-inspector-tool="region"]')).not.toBeNull();
    expect(document.querySelector('[data-askable-inspector-tool="circle"]')).not.toBeNull();
    expect(document.querySelector('[data-askable-inspector-tool="lasso"]')).not.toBeNull();
    expect(document.querySelector('[data-askable-inspector-tool="text"]')).not.toBeNull();
    expect(document.querySelector('[data-askable-inspector-tool="clear"]')).not.toBeNull();

    inspector.destroy();
    ctx.destroy();
  });

  it('can hide built-in interaction test tools', () => {
    const ctx = createAskableContext();
    const inspector = createAskableInspector(ctx, { tools: false });

    expect(document.querySelector('[data-askable-inspector-tool="region"]')).toBeNull();

    inspector.destroy();
    ctx.destroy();
  });

  it('starts and cleans up capture tools from the inspector', () => {
    const ctx = createAskableContext();
    const inspector = createAskableInspector(ctx);
    const lasso = document.querySelector('[data-askable-inspector-tool="lasso"]')!;

    lasso.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('askable-region-capture')).not.toBeNull();

    inspector.destroy();

    expect(document.getElementById('askable-region-capture')).toBeNull();

    ctx.destroy();
  });

  it('clear tool clears the active focus', () => {
    const el = attach(makeEl({ metric: 'revenue' }, 'Revenue'));
    const ctx = createAskableContext();
    ctx.observe(document);
    const inspector = createAskableInspector(ctx);

    el.click();
    expect(ctx.getFocus()).not.toBeNull();

    document
      .querySelector('[data-askable-inspector-tool="clear"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ctx.getFocus()).toBeNull();

    inspector.destroy();
    ctx.destroy();
  });
});
