# @askable-ui/svelte

Svelte 4 bindings for [askable](../../README.md) — give your UI components LLM awareness in one line.

## Install

```bash
npm install @askable-ui/svelte @askable-ui/core
```

## Quick Start

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  const { focus, promptContext, destroy } = createAskableStore();
  onDestroy(destroy);

  async function ask(question: string) {
    return fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `UI context: ${$promptContext}` },
          { role: 'user', content: question },
        ],
      }),
    });
  }
</script>

<Askable meta={{ chart: 'revenue', period: 'Q3', value: '$128k' }} as="section">
  <RevenueChart />
</Askable>

{#if $focus}
  <p>Focused: {JSON.stringify($focus.meta)}</p>
{/if}
```

## API

### `<Askable meta={...} as="div">`

Renders any element (default: `div`) with a `data-askable` attribute. Accepts a `<slot />`.

### `createAskableStore(options?)`

Returns Svelte stores backed by a core `AskableContext`.

```ts
const { focus, promptContext, ctx, destroy } = createAskableStore();
// focus: Readable<AskableFocus | null>
// promptContext: Readable<string>
// ctx: AskableContext

// Restrict which interactions trigger a context update
const { focus, promptContext, ctx, destroy } = createAskableStore({ events: ['click'] });
```

**Options:**
- `events?: AskableEvent[]` — trigger events: `'click'`, `'hover'`, `'focus'`. Defaults to all three.

### "Ask AI" button pattern

Use `ctx.select()` to set context explicitly when a user clicks a button:

```svelte
<script lang="ts">
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  const { ctx, destroy } = createAskableStore();
  onDestroy(destroy);

  let cardEl: HTMLElement;
</script>

<Askable bind:el={cardEl} meta={data}>
  <RevenueChart {data} />
  <button on:click={() => { ctx.select(cardEl); openChat(); }}>
    Ask AI ✦
  </button>
</Askable>
```

## License

MIT
