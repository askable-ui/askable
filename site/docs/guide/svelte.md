# Svelte Guide

Both Svelte 4 (store-based) and Svelte 5 (runes-based) APIs are supported.

## Install

```bash
npm install @askable-ui/svelte @askable-ui/core
```

## Quick start (Svelte 5 runes)

```svelte
<script lang="ts">
  import { useAskable } from '@askable-ui/svelte/useAskable.svelte';
  import Askable5 from '@askable-ui/svelte/Askable5.svelte';

  const { focus, promptContext, destroy, ctx } = useAskable();
  $effect(() => () => destroy());

  async function ask(question: string) {
    return fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `UI context: ${promptContext}` },
          { role: 'user', content: question },
        ],
      }),
    });
  }
</script>

<Askable5 meta={{ metric: 'revenue', value: '$128k', period: 'Q3' }}>
  <RevenueChart />
</Askable5>

{#if focus}
  <p>Focused: {JSON.stringify(focus.meta)}</p>
{/if}
```

## Quick start (Svelte 4 stores)

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
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

<Askable meta={{ metric: 'revenue', value: '$128k', period: 'Q3' }}>
  <RevenueChart />
</Askable>

{#if $focus}
  <p>Focused: {JSON.stringify($focus.meta)}</p>
{/if}
```

## Svelte 5: `useAskable(options?)`

Runes-based composable. Must be called inside a Svelte 5 component or `.svelte.ts` file.

```svelte
<script lang="ts">
  import { useAskable } from '@askable-ui/svelte/useAskable.svelte';

  // Observes document automatically (SSR-safe)
  const askable = useAskable();

  // Click events only
  const askable = useAskable({ observe: { events: ['click'] } });

  // Disable auto-observe, use a shared context
  import { createAskableContext } from '@askable-ui/core';
  const ctx = createAskableContext();
  const askable = useAskable({ ctx, observe: false });
</script>

<!-- askable.focus and askable.promptContext are reactive state -->
<p>{askable.promptContext}</p>
```

**Returns:**
| Value | Type | Description |
|---|---|---|
| `focus` | `AskableFocus \| null` | Reactive current focus (`$state`) |
| `promptContext` | `string` | Reactive prompt-ready string (`$derived`) |
| `ctx` | `AskableContext` | Underlying context for advanced use |
| `destroy` | `() => void` | Tears down the context — call in `$effect(() => () => destroy())` |

## Svelte 5: `<Askable5>`

```svelte
<script lang="ts">
  import Askable5 from '@askable-ui/svelte/Askable5.svelte';
</script>

<!-- Object meta -->
<Askable5 meta={{ widget: 'churn-rate', value: '4.2%' }}>
  <ChurnChart />
</Askable5>

<!-- String meta, custom element -->
<Askable5 meta="pricing page hero" as="section">
  <HeroSection />
</Askable5>
```

## `<Askable>` (Svelte 4)

Renders any element (default: `div`) with `data-askable` set from the `meta` prop.

```svelte
<!-- Object meta -->
<Askable meta={{ widget: 'churn-rate', value: '4.2%' }}>
  <ChurnChart />
</Askable>

<!-- String meta, custom element -->
<Askable meta="pricing page hero" as="section">
  <HeroSection />
</Askable>
```

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `meta` | `Record<string, unknown> \| string` | — | Metadata for the element |
| `as` | `string` | `"div"` | HTML element to render |

## `createAskableStore(options?)`

Factory that returns Svelte stores backed by a core `AskableContext`. Starts observing immediately (SSR-safe — the `observe()` call is guarded against non-browser environments).

```ts
const { focus, promptContext, ctx, destroy } = createAskableStore();
// focus: Readable<AskableFocus | null>
// promptContext: Readable<string>
// ctx: AskableContext

// Click only
const store = createAskableStore({ events: ['click'] });
```

Always call `destroy()` when the store is no longer needed:

```ts
import { onDestroy } from 'svelte';
const { destroy } = createAskableStore();
onDestroy(destroy);
```

**Options:**
| Option | Type | Description |
|---|---|---|
| `events` | `AskableEvent[]` | Which events trigger updates. Defaults to `['click', 'hover', 'focus']`. |
| `ctx` | `AskableContext` | Provide a scoped context instead of creating a new one. See below. |

## Scoped contexts

By default, `createAskableStore()` creates its own `AskableContext`. For surfaces that need to share a context (or require independent event policies, prompt shaping, or redaction rules), pass a pre-created `ctx`:

```ts
import { createAskableContext } from '@askable-ui/core';
import { createAskableStore } from '@askable-ui/svelte';

const sharedCtx = createAskableContext();
sharedCtx.observe(document.getElementById('dashboard')!);

// Two stores backed by the same context
const storeA = createAskableStore({ ctx: sharedCtx });
const storeB = createAskableStore({ ctx: sharedCtx });
```

When a scoped `ctx` is provided, `destroy()` on the store does **not** call `ctx.destroy()` — you manage the context lifecycle separately.

**Returns:**
| Value | Type | Description |
|---|---|---|
| `focus` | `Readable<AskableFocus \| null>` | Reactive current focus store |
| `promptContext` | `Readable<string>` | Reactive prompt-ready context store |
| `ctx` | `AskableContext` | Underlying context for advanced use |
| `destroy` | `() => void` | Tears down the context — call in `onDestroy` |

## "Ask AI" button pattern

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  const { ctx, destroy } = createAskableStore();
  onDestroy(destroy);

  let cardEl: HTMLElement;
</script>

<Askable bind:el={cardEl} meta={data}>
  <RevenueChart {data} />
  <button on:click={() => { ctx.select(cardEl); openChatPanel(); }}>
    Ask AI ✦
  </button>
</Askable>
```

## SvelteKit / SSR

`createAskableStore()` is safe to call during SSR. The `observe()` call checks for `document` and is a no-op on the server. Stores initialize with `null` / `'No UI element is currently focused.'` and hydrate on the client.
