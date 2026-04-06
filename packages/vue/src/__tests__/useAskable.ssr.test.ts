// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useAskable } from '../useAskable.js';
import { Askable } from '../Askable.js';

const Consumer = defineComponent({
  setup() {
    const { focus, promptContext } = useAskable();
    return () =>
      h('div', null, [
        h('span', { id: 'focus' }, focus.value ? 'focused' : 'null'),
        h('span', { id: 'prompt' }, promptContext.value),
      ]);
  },
});

describe('useAskable SSR (Vue)', () => {
  it('renders without touching document during SSR', async () => {
    await expect(renderToString(h(Consumer))).resolves.not.toThrow();
  });

  it('renders the no-focus prompt string', async () => {
    const html = await renderToString(h(Consumer));
    expect(html).toContain('No UI element is currently focused.');
  });

  it('focus is null during SSR', async () => {
    const html = await renderToString(h(Consumer));
    expect(html).toContain('>null<');
  });

  it('multiple sequential SSR renders do not share state', async () => {
    const html1 = await renderToString(h(Consumer));
    const html2 = await renderToString(h(Consumer));
    expect(html1).toContain('No UI element is currently focused.');
    expect(html2).toContain('No UI element is currently focused.');
  });

  it('renders deterministically across multiple calls', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => renderToString(h(Consumer)))
    );
    expect(new Set(results).size).toBe(1);
  });

  it('Askable component renders data-askable attribute during SSR', async () => {
    const el = h(Askable, { meta: { metric: 'revenue', period: 'Q3' } }, {
      default: () => 'Revenue',
    });
    const html = await renderToString(el);
    expect(html).toContain('data-askable=');
    expect(html).toContain('metric');
    expect(html).toContain('revenue');
  });

  it('Askable with string meta renders correctly during SSR', async () => {
    const el = h(Askable, { meta: 'main navigation', as: 'nav' });
    const html = await renderToString(el);
    expect(html).toContain('data-askable="main navigation"');
    expect(html).toContain('<nav');
  });

  it('scoped ctx renders correctly during SSR', async () => {
    const { createAskableContext } = await import('@askable-ui/core');
    const scopedCtx = createAskableContext();

    const ScopedConsumer = defineComponent({
      setup() {
        const { promptContext } = useAskable({ ctx: scopedCtx });
        return () => h('div', promptContext.value);
      },
    });

    const html = await renderToString(h(ScopedConsumer));
    expect(html).toContain('No UI element is currently focused.');
    scopedCtx.destroy();
  });
});
