<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    meta: Record<string, unknown> | string;
    as?: string;
    scope?: string;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { meta, as = 'div', scope, children, ...rest }: Props = $props();

  const dataAskable = $derived(typeof meta === 'string' ? meta : JSON.stringify(meta));
</script>

<svelte:element this={as} data-askable={dataAskable} data-askable-scope={scope} {...rest}>
  {@render children?.()}
</svelte:element>
