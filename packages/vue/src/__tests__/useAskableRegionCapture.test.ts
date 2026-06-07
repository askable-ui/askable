import { describe, expect, it, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { computed, defineComponent, nextTick } from 'vue';
import { useAskableRegionCapture } from '../useAskableRegionCapture.js';
import { track } from './helpers.js';

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event as PointerEvent;
}

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

afterEach(() => {
  document.getElementById('askable-region-capture')?.remove();
});

describe('useAskableRegionCapture (Vue)', () => {
  it('starts capture and exposes the captured packet', async () => {
    const Consumer = defineComponent({
      name: 'RegionCaptureConsumer',
      setup() {
        const capture = useAskableRegionCapture({
          source: { app: 'vue-test' },
          intent: 'explain selected area',
        });
        const packet = computed(() => capture.lastPacket.value ? JSON.stringify(capture.lastPacket.value) : 'null');
        const selectionState = computed(() =>
          capture.selectionState.value ? JSON.stringify(capture.selectionState.value.selection) : 'null'
        );
        return {
          active: capture.active,
          packet,
          selectionState,
          start: capture.start,
          clearSelection: capture.clearSelection,
        };
      },
      template: `
        <div>
          <button type="button" @click="start()">Start</button>
          <button type="button" data-testid="clear" @click="clearSelection()">Clear</button>
          <span data-testid="active">{{ String(active) }}</span>
          <span data-testid="packet">{{ packet }}</span>
          <span data-testid="selection-state">{{ selectionState }}</span>
        </div>
      `,
    });

    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    await wrapper.find('button').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="active"]').text()).toBe('true');

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 20, 30));
    overlay.dispatchEvent(pointerEvent('pointermove', 80, 90));
    overlay.dispatchEvent(pointerEvent('pointerup', 80, 90));
    await flushAll();

    expect(wrapper.find('[data-testid="active"]').text()).toBe('false');
    const packet = JSON.parse(wrapper.find('[data-testid="packet"]').text());
    const selectionState = JSON.parse(wrapper.find('[data-testid="selection-state"]').text());
    expect(packet).toMatchObject({
      protocol: 'askable.context',
      source: { app: 'vue-test' },
      capture: {
        mode: 'region',
        gesture: 'drag',
        intent: 'explain selected area',
      },
      target: {
        bounds: { x: 20, y: 30, width: 60, height: 60 },
        metadata: { shape: 'region', pointerType: 'mouse' },
      },
      privacy: { consent: 'explicit' },
    });
    expect(selectionState).toMatchObject({
      shape: 'region',
      bounds: { x: 20, y: 30, width: 60, height: 60 },
    });

    await wrapper.find('[data-testid="clear"]').trigger('click');
    await flushAll();
    expect(wrapper.find('[data-testid="selection-state"]').text()).toBe('null');
  });

  it('supports circle capture overrides at start time', async () => {
    const Consumer = defineComponent({
      name: 'CircleCaptureConsumer',
      setup() {
        const capture = useAskableRegionCapture();
        const packet = computed(() => capture.lastPacket.value ? JSON.stringify(capture.lastPacket.value) : 'null');
        return {
          packet,
          startCircle: () => capture.start({ shape: 'circle' }),
        };
      },
      template: `
        <div>
          <button type="button" @click="startCircle()">Circle</button>
          <span data-testid="packet">{{ packet }}</span>
        </div>
      `,
    });

    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    await wrapper.find('button').trigger('click');

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 50, 80));
    overlay.dispatchEvent(pointerEvent('pointerup', 50, 80));
    await flushAll();

    const packet = JSON.parse(wrapper.find('[data-testid="packet"]').text());
    expect(packet.capture).toMatchObject({ mode: 'circle', gesture: 'circle' });
    expect(packet.target).toMatchObject({
      bounds: { x: 0, y: 20, width: 60, height: 60 },
      metadata: {
        shape: 'circle',
        center: { x: 30, y: 50 },
        radius: 30,
      },
    });
  });

  it('supports lasso capture overrides at start time', async () => {
    const Consumer = defineComponent({
      name: 'LassoCaptureConsumer',
      setup() {
        const capture = useAskableRegionCapture();
        const packet = computed(() => capture.lastPacket.value ? JSON.stringify(capture.lastPacket.value) : 'null');
        return {
          packet,
          startLasso: () => capture.start({ shape: 'lasso' }),
        };
      },
      template: `
        <div>
          <button type="button" @click="startLasso()">Lasso</button>
          <span data-testid="packet">{{ packet }}</span>
        </div>
      `,
    });

    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    await wrapper.find('button').trigger('click');

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
    overlay.dispatchEvent(pointerEvent('pointermove', 30, 45));
    overlay.dispatchEvent(pointerEvent('pointermove', 70, 35));
    overlay.dispatchEvent(pointerEvent('pointerup', 80, 75));
    await flushAll();

    const packet = JSON.parse(wrapper.find('[data-testid="packet"]').text());
    expect(packet.capture).toMatchObject({ mode: 'lasso', gesture: 'lasso' });
    expect(packet.target).toMatchObject({
      bounds: { x: 10, y: 20, width: 70, height: 55 },
      metadata: {
        shape: 'lasso',
        pointCount: 4,
      },
    });
    expect(packet.target.metadata.points).toHaveLength(4);
  });

  it('keeps Vue state active after capture when once is false', async () => {
    const Consumer = defineComponent({
      name: 'RepeatedCaptureConsumer',
      setup() {
        const capture = useAskableRegionCapture({ once: false });
        const packet = computed(() => capture.lastPacket.value ? JSON.stringify(capture.lastPacket.value) : 'null');
        return {
          active: capture.active,
          packet,
          start: capture.start,
        };
      },
      template: `
        <div>
          <button type="button" @click="start()">Start</button>
          <span data-testid="active">{{ String(active) }}</span>
          <span data-testid="packet">{{ packet }}</span>
        </div>
      `,
    });

    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    await wrapper.find('button').trigger('click');
    await nextTick();

    expect(wrapper.find('[data-testid="active"]').text()).toBe('true');

    const overlay = document.getElementById('askable-region-capture')!;
    overlay.dispatchEvent(pointerEvent('pointerdown', 20, 30));
    overlay.dispatchEvent(pointerEvent('pointermove', 80, 90));
    overlay.dispatchEvent(pointerEvent('pointerup', 80, 90));
    await flushAll();

    expect(wrapper.find('[data-testid="packet"]').text()).not.toBe('null');
    expect(wrapper.find('[data-testid="active"]').text()).toBe('true');
    expect(document.getElementById('askable-region-capture')).toBe(overlay);
  });

  it('cancels active capture from Vue state', async () => {
    const Consumer = defineComponent({
      name: 'CancelCaptureConsumer',
      setup() {
        const capture = useAskableRegionCapture();
        return {
          active: capture.active,
          start: capture.start,
          cancel: capture.cancel,
        };
      },
      template: `
        <div>
          <button data-testid="start" type="button" @click="start()">Start</button>
          <button data-testid="cancel" type="button" @click="cancel()">Cancel</button>
          <span data-testid="active">{{ String(active) }}</span>
        </div>
      `,
    });

    const wrapper = track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    await wrapper.find('[data-testid="start"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="active"]').text()).toBe('true');

    await wrapper.find('[data-testid="cancel"]').trigger('click');
    await flushAll();

    expect(wrapper.find('[data-testid="active"]').text()).toBe('false');
    expect(document.getElementById('askable-region-capture')).toBeNull();
  });
});
