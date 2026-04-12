import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { useAskable } from '../useAskable.js';
import { track } from './helpers.js';

/** Flush MutationObserver microtasks AND Vue's async queue. */
async function flushAll() {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

const Consumer = defineComponent({
  name: 'Consumer',
  setup() {
    const { focus, promptContext } = useAskable();
    return { focus, promptContext };
  },
  template: `
    <div>
      <div
        data-testid="askable-target"
        data-askable='{"metric":"revenue","period":"Q3","value":"$2.3M"}'
      >Revenue: $2.3M</div>
      <span data-testid="focus-meta">{{ focus ? JSON.stringify(focus.meta) : 'null' }}</span>
      <span data-testid="prompt-context">{{ promptContext }}</span>
    </div>
  `,
});

describe('useAskable (Vue)', () => {
  it('returns null focus initially', async () => {
    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();
    expect(wrapper.find('[data-testid="focus-meta"]').text()).toBe('null');
  });

  it('returns the no-focus prompt string initially', async () => {
    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();
    expect(wrapper.find('[data-testid="prompt-context"]').text()).toBe(
      'No UI element is currently focused.'
    );
  });

  it('updates focus after a click on a [data-askable] element', async () => {
    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    // Flush MutationObserver so click listener is attached
    await flushAll();

    expect(wrapper.find('[data-testid="focus-meta"]').text()).toBe('null');

    await wrapper.find('[data-testid="askable-target"]').trigger('click');
    await nextTick();

    const metaText = wrapper.find('[data-testid="focus-meta"]').text();
    expect(metaText).not.toBe('null');
    const meta = JSON.parse(metaText);
    expect(meta).toEqual({ metric: 'revenue', period: 'Q3', value: '$2.3M' });
  });

  it('promptContext is non-empty string after focus', async () => {
    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    await wrapper.find('[data-testid="askable-target"]').trigger('click');
    await nextTick();

    const prompt = wrapper.find('[data-testid="prompt-context"]').text();
    expect(prompt).not.toBe('No UI element is currently focused.');
    expect(prompt).toContain('User is focused on');
    expect(prompt).toContain('revenue');
  });

  it('accepts a scoped ctx and does not touch globalCtx', async () => {
    const { createAskableContext } = await import('@askable-ui/core');
    const scopedCtx = createAskableContext();

    const ScopedConsumer = defineComponent({
      name: 'ScopedConsumer',
      setup() {
        const { focus, ctx } = useAskable({ ctx: scopedCtx });
        return { focus, ctx };
      },
      template: `
        <div>
          <div data-testid="scoped-target" data-askable='{"scope":"scoped"}'>Scoped</div>
          <span data-testid="scoped-focus">{{ focus ? JSON.stringify(focus.meta) : 'null' }}</span>
        </div>
      `,
    });

    const wrapper = track(mount(ScopedConsumer, { attachTo: document.body }));
    await flushAll();

    // scopedCtx is provided, so observe is NOT called automatically
    scopedCtx.observe(document.body);
    await flushAll();

    await wrapper.find('[data-testid="scoped-target"]').trigger('click');
    await nextTick();

    const metaText = wrapper.find('[data-testid="scoped-focus"]').text();
    expect(metaText).not.toBe('null');
    expect(JSON.parse(metaText)).toEqual({ scope: 'scoped' });

    wrapper.unmount();
    scopedCtx.destroy();
  });

  it('cleans up listener on unmount', async () => {
    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    // Click once to set focus
    await wrapper.find('[data-testid="askable-target"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="focus-meta"]').text()).not.toBe('null');

    // Unmount — should destroy ctx when refCount hits 0
    wrapper.unmount();

    // After destroy, getFocus on a new ctx should be null
    const { useAskable: ua } = await import('../useAskable.js');
    const wrapper2 = track(
      mount(
        defineComponent({
          setup() {
            const { focus } = ua();
            return { focus };
          },
          template: `<span>{{ focus ? 'has-focus' : 'null' }}</span>`,
        }),
        { attachTo: document.body }
      )
    );
    await flushAll();
    expect(wrapper2.text()).toBe('null');
  });

  it('reuses the same named shared context across consumers', async () => {
    const seen: unknown[] = [];

    const NamedConsumer = defineComponent({
      name: 'NamedConsumer',
      props: { label: { type: String, required: true } },
      setup() {
        const { ctx } = useAskable({ name: 'table' });
        seen.push(ctx);
        return {};
      },
      template: `<span>ready</span>`,
    });

    const wrapperA = track(mount(NamedConsumer, { attachTo: document.body, props: { label: 'one' } }));
    await flushAll();
    const wrapperB = track(mount(NamedConsumer, { attachTo: document.body, props: { label: 'two' } }));
    await flushAll();

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);

    wrapperB.unmount();
    wrapperA.unmount();
  });

  it('observes the shared global context only once for multiple consumers with the same events', async () => {
    let capturedCtx: ReturnType<typeof import('@askable-ui/core').createAskableContext> | null = null;

    const CaptureConsumer = defineComponent({
      name: 'CaptureConsumer',
      setup() {
        const { ctx } = useAskable();
        capturedCtx = ctx;
        return {};
      },
      template: `<span>ready</span>`,
    });

    const wrapperA = track(mount(CaptureConsumer, { attachTo: document.body }));
    await flushAll();
    expect(capturedCtx).not.toBeNull();

    const observeSpy = vi.spyOn(capturedCtx!, 'observe');
    const wrapperB = track(mount(CaptureConsumer, { attachTo: document.body }));
    await flushAll();

    expect(observeSpy).not.toHaveBeenCalled();

    wrapperB.unmount();
    wrapperA.unmount();
  });

  it('isolates differing shared event configurations and preserves the remaining config on unmount', async () => {
    const EventConsumer = defineComponent({
      name: 'EventConsumer',
      props: {
        label: { type: String, required: true },
        events: { type: Array as () => ('click' | 'focus')[], required: true },
      },
      setup(props) {
        const { focus } = useAskable({ events: props.events });
        return { focus };
      },
      template: `<span :data-testid="'event-' + label">{{ focus ? JSON.stringify(focus.meta) : 'null' }}</span>`,
    });

    const clickWrapper = track(
      mount(
        defineComponent({
          components: { EventConsumer },
          template: `
            <div>
              <button data-testid="event-target" data-askable='{"widget":"shared-events"}'>Shared events</button>
              <EventConsumer label="click" :events="['click']" />
            </div>
          `,
        }),
        { attachTo: document.body }
      )
    );
    await flushAll();

    const focusWrapper = track(mount(EventConsumer, {
      attachTo: document.body,
      props: { label: 'focus', events: ['focus'] },
    }));
    await flushAll();

    await clickWrapper.find('[data-testid="event-target"]').trigger('click');
    await nextTick();

    expect(clickWrapper.find('[data-testid="event-click"]').text()).toContain('shared-events');
    expect(focusWrapper.find('[data-testid="event-focus"]').text()).toBe('null');

    focusWrapper.unmount();

    await clickWrapper.find('[data-testid="event-target"]').trigger('click');
    await nextTick();

    expect(clickWrapper.find('[data-testid="event-click"]').text()).toContain('shared-events');

    clickWrapper.unmount();
  });
});
