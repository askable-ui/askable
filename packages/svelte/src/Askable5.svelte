<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    meta: Record<string, unknown> | string;
    as?: string;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { meta, as = 'div', children, ...rest }: Props = $props();

  const dataAskable = $derived(typeof meta === 'string' ? meta : JSON.stringify(meta));
</script>

<svelte:element this={as} data-askable={dataAskable} {...rest}>
  {@render children?.()}
</svelte:element>
