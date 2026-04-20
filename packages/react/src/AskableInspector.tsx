import { useEffect } from 'react';
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
  /** Optional viewport flag to match sibling useAskable() consumers. */
  viewport?: boolean;
};

/**
 * Declarative inspector panel. Renders nothing visible — mounts the
 * floating dev panel via createAskableInspector and cleans up on unmount.
 *
 * Pass `ctx`, `name`, `events`, or `viewport` when the inspector should
 * follow the same React-managed context configuration as sibling
 * `useAskable()` consumers.
 *
 * @example
 * {process.env.NODE_ENV === 'development' && <AskableInspector events={['click']} />}
 */
export function AskableInspector({
  ctx: providedCtx,
  name,
  events,
  viewport,
  ...inspectorOptions
}: AskableInspectorProps) {
  const { ctx } = useAskable({ ctx: providedCtx, name, events, viewport });
  const promptOptionsKey = JSON.stringify(inspectorOptions.promptOptions ?? null);

  useEffect(() => {
    const handle = createAskableInspector(ctx, inspectorOptions);
    return () => handle.destroy();
  }, [ctx, inspectorOptions.position, inspectorOptions.highlight, promptOptionsKey]);

  return null;
}
