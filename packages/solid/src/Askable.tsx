import type { ParentComponent, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';

export interface AskableProps {
  meta: Record<string, unknown> | string;
  scope?: string;
  as?: string;
  [key: string]: unknown;
}

/**
 * Wrap any element to annotate it with structured data for AI assistants.
 *
 * @example
 * ```tsx
 * <Askable meta={{ metric: 'revenue', value: '$2.3M' }}>
 *   <div>Revenue: $2.3M</div>
 * </Askable>
 * ```
 */
export const Askable: ParentComponent<AskableProps> = (rawProps) => {
  const [local, rest] = splitProps(rawProps, ['meta', 'scope', 'as', 'children']);

  const metaStr = () =>
    typeof local.meta === 'string' ? local.meta : JSON.stringify(local.meta);

  return (
    <Dynamic
      component={local.as ?? 'div'}
      data-askable={metaStr()}
      data-askable-scope={local.scope}
      {...(rest as JSX.HTMLAttributes<HTMLElement>)}
    >
      {local.children}
    </Dynamic>
  );
};
