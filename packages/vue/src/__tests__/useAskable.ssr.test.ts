// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useAskable } from '../useAskable.js';

const Consumer = defineComponent({
  setup() {
    const { promptContext } = useAskable();
    return () => h('div', promptContext.value);
  },
});

describe('useAskable SSR (Vue)', () => {
  it('renders without touching document during SSR', async () => {
    await expect(renderToString(h(Consumer))).resolves.toContain('No UI element is currently focused.');
  });
});
