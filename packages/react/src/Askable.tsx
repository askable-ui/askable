import React from 'react';
import type { AskableEvent } from '@askable-ui/core';

type AnyTag = keyof React.JSX.IntrinsicElements;
type AskableActivation = AskableEvent[] | 'manual';

type AskableProps<T extends AnyTag = 'div'> = {
  meta: Record<string, unknown> | string;
  scope?: string;
  events?: AskableActivation;
  as?: T;
  children?: React.ReactNode;
} & Omit<React.JSX.IntrinsicElements[T], 'children'>;

export function Askable<T extends AnyTag = 'div'>({
  meta,
  scope,
  events,
  as,
  children,
  ...props
}: AskableProps<T>) {
  const Tag = (as ?? 'div') as string;
  const dataAskable = typeof meta === 'string' ? meta : JSON.stringify(meta);
  const dataAskableEvents = Array.isArray(events) ? events.join(',') : events;
  return React.createElement(
    Tag,
    {
      'data-askable': dataAskable,
      ...(scope ? { 'data-askable-scope': scope } : {}),
      ...(dataAskableEvents ? { 'data-askable-events': dataAskableEvents } : {}),
      ...props,
    },
    children
  );
}
