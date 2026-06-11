import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { useAskableViewport } from '../useAskableViewport.js';
import { track } from './helpers.js';

// Minimal IntersectionObserver mock
type IOEntry = { target: Element; isIntersecting: boolean };
type IOCallback = (entries: IOEntry[]) => void;

let observerCallbacks: IOCallback[] = [];
let observedElements: Element[] = [];

beforeEach(() => {
  observerCallbacks = [];
  observedElements = [];

  vi.stubGlobal(
    'IntersectionObserver',
    class MockIO {
      constructor(cb: IOCallback) {
        observerCallbacks.push(cb);
      }
      observe(el: Element) {
        observedElements.push(el);
      }
      unobserve(el: Element) {
        observedElements = observedElements.filter((e) => e !== el);
      }
      disconnect() {
        observerCallbacks = [];
        observedElements = [];
      }
    },
  );
});

function triggerIntersection(entries: IOEntry[]) {
  observerCallbacks.forEach((cb) => cb(entries));
}

async function flushAll() {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

describe('useAskableViewport (Vue)', () => {
  it('starts with no visible items', async () => {
    const C = defineComponent({
      setup() {
        const { visibleItems } = useAskableViewport();
        return { visibleItems };
      },
      template: `<span data-testid="count">{{ visibleItems.length }}</span>`,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();
    expect(wrapper.find('[data-testid="count"]').text()).toBe('0');
  });

  it('returns empty-state prompt initially', async () => {
    const C = defineComponent({
      setup() {
        const { promptContext } = useAskableViewport();
        return { promptContext };
      },
      template: `<span data-testid="prompt">{{ promptContext }}</span>`,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();
    expect(wrapper.find('[data-testid="prompt"]').text()).toBe(
      'No annotated elements are currently visible in the viewport.',
    );
  });

  it('adds an item when an element becomes intersecting', async () => {
    const C = defineComponent({
      setup() {
        const { visibleItems } = useAskableViewport();
        return { visibleItems };
      },
      template: `
        <div>
          <span data-testid="count">{{ visibleItems.length }}</span>
          <div data-askable='{"metric":"revenue"}'>Revenue</div>
        </div>
      `,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();

    const el = wrapper.find<HTMLElement>('[data-askable]').element;
    triggerIntersection([{ target: el, isIntersecting: true }]);
    await nextTick();

    expect(wrapper.find('[data-testid="count"]').text()).toBe('1');
  });

  it('removes an item when it leaves the viewport', async () => {
    const C = defineComponent({
      setup() {
        const { visibleItems } = useAskableViewport();
        return { visibleItems };
      },
      template: `
        <div>
          <span data-testid="count">{{ visibleItems.length }}</span>
          <div data-askable='{"metric":"revenue"}'>Revenue</div>
        </div>
      `,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();

    const el = wrapper.find<HTMLElement>('[data-askable]').element;
    triggerIntersection([{ target: el, isIntersecting: true }]);
    await nextTick();
    expect(wrapper.find('[data-testid="count"]').text()).toBe('1');

    triggerIntersection([{ target: el, isIntersecting: false }]);
    await nextTick();
    expect(wrapper.find('[data-testid="count"]').text()).toBe('0');
  });

  it('filters by scope attribute', async () => {
    const C = defineComponent({
      setup() {
        const { visibleItems } = useAskableViewport({ scope: 'sales' });
        return { visibleItems };
      },
      template: `
        <div>
          <span data-testid="count">{{ visibleItems.length }}</span>
          <div data-askable='{"metric":"revenue"}' data-askable-scope="sales">Sales</div>
          <div data-askable='{"metric":"hr"}' data-askable-scope="hr">HR</div>
        </div>
      `,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();

    const els = wrapper.findAll<HTMLElement>('[data-askable]');
    triggerIntersection([
      { target: els[0].element, isIntersecting: true },
      { target: els[1].element, isIntersecting: true },
    ]);
    await nextTick();

    expect(wrapper.find('[data-testid="count"]').text()).toBe('1');
  });

  it('builds a prompt context string for visible items', async () => {
    const C = defineComponent({
      setup() {
        const { promptContext } = useAskableViewport();
        return { promptContext };
      },
      template: `
        <div>
          <span data-testid="prompt">{{ promptContext }}</span>
          <div data-askable='{"metric":"revenue"}'>Revenue: $2.3M</div>
        </div>
      `,
    });

    const wrapper = track(mount(C, { attachTo: document.body }));
    await flushAll();

    const el = wrapper.find<HTMLElement>('[data-askable]').element;
    triggerIntersection([{ target: el, isIntersecting: true }]);
    await nextTick();

    const prompt = wrapper.find('[data-testid="prompt"]').text();
    expect(prompt).toContain('Visible UI elements:');
    expect(prompt).toContain('revenue');
  });
});
