import type { ValidComponent, JSX, ComponentProps } from 'solid-js';
import { splitProps, mergeProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';

type AskableOwnProps<T extends ValidComponent = 'div'> = {
  meta: Record<string, unknown> | string;
  as?: T;
  children?: JSX.Element;
};

type AskableProps<T extends ValidComponent = 'div'> = AskableOwnProps<T> &
  Omit<ComponentProps<T>, keyof AskableOwnProps<T>>;

export function Askable<T extends ValidComponent = 'div'>(
  rawProps: AskableProps<T>,
) {
  const props = mergeProps({ as: 'div' as ValidComponent }, rawProps);
  const [local, rest] = splitProps(props as AskableOwnProps & Record<string, unknown>, [
    'meta',
    'as',
    'children',
  ]);

  const dataAskable = () =>
    typeof local.meta === 'string' ? local.meta : JSON.stringify(local.meta);

  return (
    <Dynamic component={local.as} data-askable={dataAskable()} {...rest}>
      {local.children}
    </Dynamic>
  );
}
