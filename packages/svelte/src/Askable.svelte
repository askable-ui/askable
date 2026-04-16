<script lang="ts">
  export let meta: Record<string, unknown> | string;
  export let scope: string | undefined = undefined;
  export let as: string = 'div';

  $: dataAskable = typeof meta === 'string' ? meta : JSON.stringify(meta);
</script>

<svelte:element this={as} data-askable={dataAskable} data-askable-scope={scope} {...$$restProps}>
  <slot />
</svelte:element>
