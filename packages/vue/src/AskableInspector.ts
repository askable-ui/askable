import { defineComponent, onMounted, onUnmounted } from 'vue';
import { createAskableInspector } from '@askable-ui/core';
import type { AskableInspectorOptions } from '@askable-ui/core';
import { useAskable } from './useAskable.js';

export const AskableInspector = defineComponent({
  name: 'AskableInspector',
  props: {
    position: { type: String as () => AskableInspectorOptions['position'], default: 'bottom-right' },
    highlight: { type: Boolean, default: true },
  },
  setup(props) {
    const { ctx } = useAskable();
    let handle: { destroy(): void } | null = null;

    onMounted(() => {
      handle = createAskableInspector(ctx, {
        position: props.position,
        highlight: props.highlight,
      });
    });

    onUnmounted(() => {
      handle?.destroy();
    });

    return () => null;
  },
});
