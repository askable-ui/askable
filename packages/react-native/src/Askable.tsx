import React from 'react';
import type { ReactElement } from 'react';
import type { AskableContext, AskableFocusSegment } from '@askable-ui/core';

const AskableHierarchyContext = React.createContext<AskableFocusSegment[]>([]);

export interface AskableProps {
  ctx: AskableContext;
  meta: Record<string, unknown> | string;
  scope?: string;
  text?: string;
  children: ReactElement<{ onPress?: () => void; onLongPress?: () => void }>;
}

export function Askable({ ctx, meta, scope, text = '', children }: AskableProps) {
  const child = React.Children.only(children);
  const parentAncestors = React.useContext(AskableHierarchyContext);
  const currentSegment = React.useMemo<AskableFocusSegment>(() => ({
    meta,
    ...(scope ? { scope } : {}),
    text,
  }), [meta, scope, text]);
  const nextAncestors = React.useMemo(
    () => [...parentAncestors, currentSegment],
    [currentSegment, parentAncestors],
  );
  const originalOnPress = child.props.onPress;
  const originalOnLongPress = child.props.onLongPress;

  const focus = () => {
    ctx.push(meta, text, {
      ...(scope ? { scope } : {}),
      ...(parentAncestors.length ? { ancestors: parentAncestors } : {}),
    });
  };

  return (
    <AskableHierarchyContext.Provider value={nextAncestors}>
      {React.cloneElement(child, {
        onPress: () => {
          originalOnPress?.();
          focus();
        },
        onLongPress: () => {
          originalOnLongPress?.();
          focus();
        },
      })}
    </AskableHierarchyContext.Provider>
  );
}
