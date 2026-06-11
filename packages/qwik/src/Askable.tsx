import { component$, Slot, type JSXChildren } from '@builder.io/qwik';

export interface AskableProps {
  meta: string | Record<string, unknown>;
  scope?: string;
  as?: string;
  class?: string;
  style?: Record<string, string> | string;
  [key: string]: unknown;
}

/**
 * Renders a DOM element annotated with `data-askable` and optionally
 * `data-askable-scope`. Wrap any content the AI should be aware of.
 *
 * ```tsx
 * <Askable meta={{ metric: 'revenue', value: '$2.4M' }} scope="kpis">
 *   <article>$2.4M</article>
 * </Askable>
 * ```
 */
export const Askable = component$<AskableProps>((props) => {
  const { meta, scope, as: Tag = 'div', ...rest } = props;
  const metaStr = typeof meta === 'string' ? meta : JSON.stringify(meta);

  // Qwik doesn't support dynamic tag names via JSX variable — use a div wrapper trick
  return (
    <div
      data-askable={metaStr}
      data-askable-scope={scope}
      {...rest}
    >
      <Slot />
    </div>
  );
});
