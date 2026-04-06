// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useAskable } from '../useAskable.js';
import { Askable } from '../Askable.js';

// Force-reset the module singleton between tests so they are independent.
// The module exports these via closure — we rely on the SSR fix (no singleton
// in SSR) to keep tests isolated even without explicit reset.

function Consumer({
  events,
}: { events?: string[] } = {}) {
  const { focus, promptContext } = useAskable(
    events ? { events: events as never[] } : undefined
  );
  return React.createElement(
    'div',
    null,
    React.createElement('span', { id: 'focus' }, focus ? 'focused' : 'null'),
    React.createElement('span', { id: 'prompt' }, promptContext),
  );
}

describe('useAskable SSR (React)', () => {
  it('renders without touching document during SSR', () => {
    expect(() => renderToString(React.createElement(Consumer))).not.toThrow();
  });

  it('renders the no-focus prompt string', () => {
    const html = renderToString(React.createElement(Consumer));
    expect(html).toContain('No UI element is currently focused.');
  });

  it('focus is null during SSR', () => {
    const html = renderToString(React.createElement(Consumer));
    expect(html).toContain('>null<');
  });

  it('multiple sequential SSR renders do not share state', () => {
    const html1 = renderToString(React.createElement(Consumer));
    const html2 = renderToString(React.createElement(Consumer));
    // Both renders independently return the no-focus state
    expect(html1).toContain('No UI element is currently focused.');
    expect(html2).toContain('No UI element is currently focused.');
  });

  it('renders deterministically across multiple calls', () => {
    const results = Array.from({ length: 5 }, () =>
      renderToString(React.createElement(Consumer))
    );
    // All renders should produce identical output
    expect(new Set(results).size).toBe(1);
  });

  it('Askable component renders data-askable attribute during SSR', () => {
    const el = React.createElement(
      Askable,
      { meta: { metric: 'revenue', period: 'Q3' } },
      'Revenue'
    );
    const html = renderToString(el);
    expect(html).toContain('data-askable=');
    expect(html).toContain('metric');
    expect(html).toContain('revenue');
  });

  it('Askable with string meta renders correctly during SSR', () => {
    const el = React.createElement(
      Askable,
      { meta: 'main navigation', as: 'nav' as never },
    );
    const html = renderToString(el);
    expect(html).toContain('data-askable="main navigation"');
    expect(html).toContain('<nav');
  });

  it('scoped ctx renders correctly during SSR', async () => {
    const { createAskableContext } = await import('@askable-ui/core');
    const scopedCtx = createAskableContext();

    function ScopedConsumer() {
      const { promptContext } = useAskable({ ctx: scopedCtx });
      return React.createElement('div', null, promptContext);
    }

    const html = renderToString(React.createElement(ScopedConsumer));
    expect(html).toContain('No UI element is currently focused.');
    scopedCtx.destroy();
  });
});
