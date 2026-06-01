import { describe, expect, it, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { computed, defineComponent, nextTick } from 'vue';
import { useAskableTextSelectionCapture } from '../useAskableTextSelectionCapture.js';
import { track } from './helpers.js';

function selectText(text: string): HTMLElement {
  const el = document.createElement('p');
  el.id = 'vue-selection';
  el.textContent = text;
  document.body.appendChild(el);

  const range = document.createRange();
  range.setStart(el.firstChild!, 0);
  range.setEnd(el.firstChild!, text.length);
  Object.defineProperty(range, 'getBoundingClientRect', {
    value: () => ({ x: 10, y: 15, width: 120, height: 20 }),
  });

  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return el;
}

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.querySelectorAll('#vue-selection').forEach((el) => el.remove());
});

describe('useAskableTextSelectionCapture (Vue)', () => {
  it('fires onCapture via selectionchange event when started', async () => {
    const captured: unknown[] = [];
    const Consumer = defineComponent({
      name: 'SelectionChangeConsumer',
      setup() {
        const capture = useAskableTextSelectionCapture({
          debounce: 0,
          onCapture: (packet) => { captured.push(packet); },
        });
        capture.start();
        return {};
      },
      template: '<div />',
    });

    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    selectText('Selectionchange fires');
    document.dispatchEvent(new Event('selectionchange'));
    await flushAll();

    expect(captured.length).toBe(1);
    expect((captured[0] as { target?: { text?: string } }).target?.text).toBe('Selectionchange fires');

    wrapper.unmount();
  });

  it('stops listening after cancel()', async () => {
    const captured: unknown[] = [];
    const Consumer = defineComponent({
      name: 'CancelConsumer',
      setup() {
        const capture = useAskableTextSelectionCapture({
          debounce: 0,
          onCapture: (packet) => { captured.push(packet); },
        });
        capture.start();
        capture.cancel();
        return {};
      },
      template: '<div />',
    });

    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    selectText('Should not be captured');
    document.dispatchEvent(new Event('selectionchange'));
    await flushAll();

    expect(captured.length).toBe(0);

    wrapper.unmount();
  });

  it('captures the current browser selection', async () => {
    const Consumer = defineComponent({
      name: 'TextSelectionCaptureConsumer',
      setup() {
        const capture = useAskableTextSelectionCapture({
          source: { app: 'vue-test' },
          intent: 'summarize selection',
        });
        const packet = computed(() => capture.lastPacket.value ? JSON.stringify(capture.lastPacket.value) : 'null');
        return {
          packet,
          captureNow: capture.captureNow,
        };
      },
      template: `
        <div>
          <button type="button" @click="captureNow()">Capture</button>
          <span data-testid="packet">{{ packet }}</span>
        </div>
      `,
    });

    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    selectText('Selected Vue copy');
    await wrapper.find('button').trigger('click');
    await flushAll();

    const packet = JSON.parse(wrapper.find('[data-testid="packet"]').text());
    expect(packet).toMatchObject({
      source: { app: 'vue-test' },
      capture: {
        mode: 'text-selection',
        gesture: 'programmatic',
        intent: 'summarize selection',
      },
      target: {
        text: 'Selected Vue copy',
        selector: '#vue-selection',
      },
      privacy: { consent: 'explicit' },
    });
  });
});
