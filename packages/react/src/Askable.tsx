import React from 'react';

type AnyTag = keyof React.JSX.IntrinsicElements;

type AskableProps<T extends AnyTag = 'div'> = {
  meta: Record<string, unknown> | string;
  scope?: string;
  as?: T;
  children?: React.ReactNode;
} & Omit<React.JSX.IntrinsicElements[T], 'children'>;

export function Askable<T extends AnyTag = 'div'>({
  meta,
  scope,
  as,
  children,
  ...props
}: AskableProps<T>) {
  const Tag = (as ?? 'div') as string;
  const dataAskable = typeof meta === 'string' ? meta : JSON.stringify(meta);
  return React.createElement(
    Tag,
    { 'data-askable': dataAskable, ...(scope ? { 'data-askable-scope': scope } : {}), ...props },
    children
  );
}
