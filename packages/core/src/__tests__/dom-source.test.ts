import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAskableDOMSource } from '../dom-source.js';
import { createAskableContext } from '../index.js';

function createElement(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  return div.firstElementChild as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createAskableDOMSource', () => {
  it('registers as kind "dom"', async () => {
    const el = createElement('<p>Hello</p>');
    const ctx = createAskableContext();
    ctx.registerSource('content', createAskableDOMSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('content');
    expect(resolved.kind).toBe('dom');
    ctx.destroy();
  });

  it('returns tag name and text content', async () => {
    const el = createElement('<article>The quick brown fox</article>');
    const ctx = createAskableContext();
    ctx.registerSource('doc', createAskableDOMSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('doc');
    const data = resolved.data as { tag: string; text: string };
    expect(data.tag).toBe('article');
    expect(data.text).toBe('The quick brown fox');
    ctx.destroy();
  });

  it('captures aria-label', async () => {
    const el = createElement('<button aria-label="Close dialog">×</button>');
    const ctx = createAskableContext();
    ctx.registerSource('btn', createAskableDOMSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('btn');
    const data = resolved.data as { label: string };
    expect(data.label).toBe('Close dialog');
    ctx.destroy();
  });

  it('captures data attributes', async () => {
    const el = createElement('<div data-user-id="42" data-role="admin">Content</div>');
    const ctx = createAskableContext();
    ctx.registerSource('el', createAskableDOMSource({ getElement: () => el }));

    const resolved = await ctx.resolveSource('el');
    const data = resolved.data as { data: Record<string, string> };
    expect(data.data['user-id']).toBe('42');
    expect(data.data.role).toBe('admin');
    ctx.destroy();
  });

  it('captures selected attributes from includeAttributes', async () => {
    const el = createElement('<a href="/about" target="_blank">About</a>');
    const ctx = createAskableContext();
    ctx.registerSource('link', createAskableDOMSource({
      getElement: () => el,
      includeAttributes: ['href', 'target'],
    }));

    const resolved = await ctx.resolveSource('link');
    const data = resolved.data as { attributes: Record<string, string> };
    expect(data.attributes.href).toBe('/about');
    expect(data.attributes.target).toBe('_blank');
    ctx.destroy();
  });

  it('truncates text to maxTextLength', async () => {
    const longText = 'x'.repeat(5000);
    const el = createElement(`<p>${longText}</p>`);
    const ctx = createAskableContext();
    ctx.registerSource('doc', createAskableDOMSource({
      getElement: () => el,
      maxTextLength: 100,
    }));

    const resolved = await ctx.resolveSource('doc');
    const data = resolved.data as { text: string };
    expect(data.text.length).toBe(100);
    ctx.destroy();
  });

  it('returns available: false when element is null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('missing', createAskableDOMSource({ getElement: () => null }));

    const resolved = await ctx.resolveSource('missing', { mode: 'state' });
    expect(resolved.state).toMatchObject({ available: false });
    ctx.destroy();
  });

  it('accepts a custom kind', async () => {
    const el = createElement('<canvas />');
    const ctx = createAskableContext();
    ctx.registerSource('chart', createAskableDOMSource({ getElement: () => el, kind: 'canvas' }));

    const resolved = await ctx.resolveSource('chart');
    expect(resolved.kind).toBe('canvas');
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const el = createElement('<section data-title="Q3 Revenue">Content</section>');
    const source = createAskableDOMSource({
      getElement: () => el,
      describe: (snap) => `Section: ${snap.data.title}`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('Q3 Revenue');
  });
});
