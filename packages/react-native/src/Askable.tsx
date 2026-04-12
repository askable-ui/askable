import React from 'react';
import type { ReactElement } from 'react';
import type { AskableContext } from '@askable-ui/core';

export interface AskableProps {
  ctx: AskableContext;
  meta: Record<string, unknown> | string;
  text?: string;
  children: ReactElement<{ onPress?: () => void; onLongPress?: () => void }>;
}

export function Askable({ ctx, meta, text = '', children }: AskableProps) {
  const child = React.Children.only(children);
  const originalOnPress = child.props.onPress;
  const originalOnLongPress = child.props.onLongPress;

  const focus = () => {
    ctx.push(meta, text);
  };

  return React.cloneElement(child, {
    onPress: () => {
      originalOnPress?.();
      focus();
    },
    onLongPress: () => {
      originalOnLongPress?.();
      focus();
    },
  });
}
