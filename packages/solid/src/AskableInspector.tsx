import { createEffect, onCleanup, type ParentComponent } from 'solid-js';
import { createAskableInspector } from '@askable-ui/core';
import type { AskableContext, AskableEvent, AskableInspectorOptions } from '@askable-ui/core';
import { useAskable } from './useAskable.js';

export type AskableInspectorProps = AskableInspectorOptions & {
  /** Reuse an existing AskableContext for the inspector. */
  ctx?: AskableContext;
  /** Optional shared context name to match sibling useAskable() consumers. */
  name?: string;
  /** Optional event config to match sibling useAskable() consumers. */
  events?: AskableEvent[];
};

/**
 * Declarative inspector panel for SolidJS. Renders nothing visible —
 * mounts the floating dev panel via createAskableInspector and cleans up
 * when the component is removed.
 *
 * @example
 * {import.meta.env.DEV && <AskableInspector events={['click']} />}
 */
export const AskableInspector: ParentComponent<AskableInspectorProps> = (props) => {
  const { ctx } = useAskable(props.ctx ? { ctx: props.ctx } : { name: props.name, events: props.events });

  createEffect(() => {
    const handle = createAskableInspector(ctx, {
      position: props.position,
      highlight: props.highlight,
      tools: props.tools,
      promptOptions: props.promptOptions,
      sourcePreview: props.sourcePreview,
    });
    onCleanup(() => handle.destroy());
  });

  return null;
};
