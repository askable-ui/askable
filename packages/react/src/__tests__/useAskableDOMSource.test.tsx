import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableDOMSource } from '../useAskableDOMSource.js';
import type { UseAskableDOMSourceResult } from '../useAskableDOMSource.js';

let hookRef: UseAskableDOMSourceResult | undefined;

function DOMConsumer({
  ctx,
  elementRef,
  ...rest
}: Parameters<typeof useAskableDOMSource>[0] & {
  ctx: ReturnType<typeof createAskableContext>;
  elementRef?: React.RefObject<Element | null>;
}) {
  hookRef = useAskableDOMSource({ ctx, ref: elementRef, ...rest });
  return null;
}

function setupEl(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el.firstElementChild as HTMLElement;
}

describe('useAskableDOMSource', () => {
  afterEach(() => {
    hookRef = undefined;
    document.body.innerHTML = '';
  });

  it('registers under "dom" id by default', () => {
    const ctx = createAskableContext();
    render(<DOMConsumer ctx={ctx} />);

    expect(ctx.hasSource('dom')).toBe(true);
    expect(hookRef!.sourceId).toBe('dom');
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    render(<DOMConsumer ctx={ctx} id="editor" />);

    expect(ctx.hasSource('editor')).toBe(true);
    ctx.destroy();
  });

  it('captures element text via selector', async () => {
    const el = setupEl('<p id="my-el">Hello world</p>');
    el.id = 'my-el';
    const ctx = createAskableContext();

    render(<DOMConsumer ctx={ctx} id="para" selector="#my-el" />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { tag: string; text: string };
    expect(data.tag).toBe('p');
    expect(data.text).toBe('Hello world');
    ctx.destroy();
  });

  it('captures element via ref', async () => {
    const elRef = createRef<HTMLElement>();
    const el = setupEl('<section>Section content</section>');
    (elRef as React.MutableRefObject<HTMLElement>).current = el;

    const ctx = createAskableContext();
    render(<DOMConsumer ctx={ctx} id="section" elementRef={elRef} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { tag: string; text: string };
    expect(data.tag).toBe('section');
    expect(data.text).toBe('Section content');
    ctx.destroy();
  });

  it('captures data attributes', async () => {
    setupEl('<div id="widget" data-chart-type="bar" data-metric="revenue">chart</div>');
    const ctx = createAskableContext();

    render(<DOMConsumer ctx={ctx} id="chart" selector="#widget" />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { data: Record<string, string> };
    expect(data.data['chart-type']).toBe('bar');
    expect(data.data.metric).toBe('revenue');
    ctx.destroy();
  });

  it('captures included attributes', async () => {
    setupEl('<a id="lnk" href="/docs" target="_blank">Docs</a>');
    const ctx = createAskableContext();

    render(
      <DOMConsumer ctx={ctx} id="link" selector="#lnk" includeAttributes={['href', 'target']} />,
    );

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { attributes: Record<string, string> };
    expect(data.attributes.href).toBe('/docs');
    expect(data.attributes.target).toBe('_blank');
    ctx.destroy();
  });

  it('returns null data when element is not found', async () => {
    const ctx = createAskableContext();
    render(<DOMConsumer ctx={ctx} id="ghost" selector="#does-not-exist" />);

    const resolved = await hookRef!.resolve();
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('unregisters on unmount', () => {
    const ctx = createAskableContext();
    const { unmount } = render(<DOMConsumer ctx={ctx} />);

    expect(ctx.hasSource('dom')).toBe(true);
    unmount();
    expect(ctx.hasSource('dom')).toBe(false);
    ctx.destroy();
  });
});
