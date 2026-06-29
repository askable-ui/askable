# Custom Sources

[Focus](/guide/focus-history) captures **what the user is looking at**. **Sources** expose **what your app knows** — cart contents, table rows, form state, the current route — so an AI assistant can pull that data on demand instead of you stuffing everything into the prompt up front.

A source is registered once and resolved lazily: nothing is serialized until something asks for it, and the source decides how much to return for the requested **mode**.

## Registering a source

`ctx.registerSource(id, source)` adds a source and returns a handle:

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();

const handle = ctx.registerSource('cart', {
  kind: 'cart',
  describe: 'The shopping cart contents and totals',
  getState: () => ({ currency: 'USD', couponApplied }),
  resolve: ({ mode }) => {
    if (mode === 'summary') return { itemCount: cart.length, total };
    return { items: cart, total };          // 'all' / 'selected' / etc.
  },
});

// When the cart changes, tell askable so caches refresh:
handle.notifyChanged();

// When you're done:
handle.unregister();
```

### The `AskableContextSource` shape

| Field | Purpose |
|---|---|
| `kind` | Category label (`'collection'`, `'document'`, `'chart'`, `'cart'`, …) for pickers and inspectors. |
| `describe` | Human-readable description (string or `() => string`). Helps the AI decide whether to read it. |
| `getState` | Cheap, always-included app state: filters, sort, page, route, viewport. |
| `resolve` | Returns the app-owned data for the requested mode. The heavy part — only called when the source is requested. |
| `modes` | The modes this source advertises (for source pickers / agent controls). |
| `sanitize` | Redact or transform the resolved source before it is serialized (see [Sanitization](#sanitization)). |

## Modes

`resolve(request)` receives a `mode` so a source can return the right slice of data:

| Mode | Meaning |
|---|---|
| `summary` *(default)* | A compact overview — counts, totals, headline values. |
| `state` | Just the app state (filters/sort/route) without the records. |
| `visible` | Only what's currently on screen. |
| `selected` | Only what the user has selected (rows, ranges, cells). |
| `all` | Everything the source can return. |
| *(custom string)* | Your own modes — the source decides what they mean. |

The resolve request also carries the current `focus`, an optional app-defined `selection` payload (row ids, ranges, canvas bounds), and `maxItems` / `maxTokens` / `timeoutMs` / `signal` budgets.

## Reading sources

Sources are pulled in by the **async** serializers — pass `sources: 'all'` or a list of source requests:

```ts
// Prompt string including every registered source
const prompt = await ctx.toPromptContextAsync({ sources: 'all' });

// Structured packet with specific sources and modes
const packet = await ctx.toContextPacketAsync({
  sources: [
    { id: 'cart', mode: 'summary' },
    { id: 'orders', mode: 'selected', maxItems: 50 },
  ],
});

// Resolve a single source directly
const resolved = await ctx.resolveSource('cart', { mode: 'all' });

// Discover what's registered (no resolving)
const available = ctx.listSources(); // → [{ id, kind, modes, registeredAt, updatedAt }]
```

`subscribeAsync()` re-runs your callback whenever focus or a source changes — handy for live context panels.

## Prebuilt sources

You rarely write a source by hand. `@askable-ui/core` ships factories for the common cases, each wrapped as a framework hook (`useAskableCartSource`, `useAskableTableSource`, …):

| Factory | Hook | Exposes |
|---|---|---|
| `createAskableCollectionSource` | `useAskableTableSource` | Rows, columns, selection, filters, sort, summary |
| `createAskableCartSource` | `useAskableCartSource` | Cart items + computed totals |
| `createAskableFormSource` | `useAskableFormSource` | Field values and validation state |
| `createAskableMultistepSource` | `useAskableMultistepSource` | Wizard/stepper progress |
| `createAskableUserSource` | `useAskableUserSource` | Authenticated user identity |
| `createAskableNavigationSource` | `useAskableNavigationSource` | Route history |
| `createAskablePageSource` | `useAskablePageSource` | Title, URL, headings, links |
| `createAskableErrorSource` | `useAskableErrorSource` | Recent application errors |
| `createAskableNotificationSource` | `useAskableNotificationSource` | Active toasts and alerts |

…plus device/environment sources (`theme`, `network`, `battery`, `geolocation`, `locale`, `permission`, `media`, `scroll`, `storage`, `clipboard`, `idle`, `time`, and more). See each [framework guide](/guide/react) for the full hook list.

For an arbitrary collection, `createAskableCollectionSource` is the workhorse:

```ts
import { createAskableCollectionSource } from '@askable-ui/core';

const orders = createAskableCollectionSource({
  kind: 'table',
  describe: 'Open orders table',
  getState: () => ({ filter: activeFilter, sort: currentSort }),
  getItems: () => allOrders,
  getVisibleItems: () => ordersOnScreen,
  getSelectedItems: () => selectedOrders,
  getItemId: (order) => order.id,
  maxItems: 100,
});

ctx.registerSource('orders', orders);
```

## Framework hooks

Every framework package wraps `registerSource` as `useAskableSource(id, source, options)`, so registration and cleanup follow the component lifecycle:

```tsx
// React
import { useAskableSource } from '@askable-ui/react';

function CartSource({ cart }: { cart: CartItem[] }) {
  const { notifyChanged } = useAskableSource('cart', {
    kind: 'cart',
    describe: 'Shopping cart contents',
    resolve: () => ({ items: cart, count: cart.length }),
  });

  // call notifyChanged() after the cart updates
  return null;
}
```

The same hook exists in Vue, Svelte, Solid, Qwik, and React Native. The dedicated hooks above (`useAskableCartSource`, etc.) are thin wrappers that build the source for you and return reactive state plus mutators.

## Sanitization

A source's `sanitize` hook lets you redact or reshape its data before it leaves the browser — strip PII, drop internal ids, truncate large blobs:

```ts
ctx.registerSource('users', {
  kind: 'collection',
  resolve: () => userRows,
  sanitize: (resolved) => ({
    ...resolved,
    data: (resolved.data as User[]).map(({ id, name }) => ({ id, name })), // drop email/phone
  }),
});
```

See [Prompt Serialization](/guide/serialization) for redaction at the packet level.

## SSR

`registerSource` is safe to call during server rendering — sources are only resolved when you `await` one of the async serializers, which you typically do in the browser or in your AI handler. The framework hooks register inside effects, so they're inert on the server. See [SSR Safety](/guide/ssr).
