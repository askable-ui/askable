import { useEffect } from 'react';
import { createAskableInspector } from '@askable-ui/core';
import type { AskableInspectorOptions } from '@askable-ui/core';
import { useAskable } from './useAskable.js';

export type AskableInspectorProps = AskableInspectorOptions;

/**
 * Declarative inspector panel. Renders nothing visible — mounts the
 * floating dev panel via createAskableInspector and cleans up on unmount.
 *
 * @example
 * {process.env.NODE_ENV === 'development' && <AskableInspector />}
 */
export function AskableInspector(props: AskableInspectorProps) {
  const { ctx } = useAskable();

  useEffect(() => {
    const handle = createAskableInspector(ctx, props);
    return () => handle.destroy();
  }, [ctx, props.position, props.highlight]);

  return null;
}
