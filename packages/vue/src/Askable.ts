import { defineComponent, h } from 'vue';

export const Askable = defineComponent({
  name: 'Askable',
  inheritAttrs: false,
  props: {
    meta: {
      type: [Object, String] as unknown as () => Record<string, unknown> | string,
      required: true,
    },
    as: {
      type: String,
      default: 'div',
    },
    scope: {
      type: String,
      default: undefined,
    },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const dataAskable =
        typeof props.meta === 'string' ? props.meta : JSON.stringify(props.meta);
      return h(
        props.as,
        { 'data-askable': dataAskable, ...(props.scope ? { 'data-askable-scope': props.scope } : {}), ...attrs },
        slots.default?.()
      );
    };
  },
});
