# Cart & Multistep Sources

Two of the most common things an AI assistant needs to reason about are a **shopping cart** ("what's in my cart and what's the total?") and a **wizard/stepper flow** ("which step am I on and what's left?"). askable-ui ships dedicated [sources](/guide/sources) for both so you don't hand-roll the snapshot logic — totals, progress, and completion are computed for you.

Both are available as framework hooks (`useAskableCartSource`, `useAskableMultistepSource`) and as core factories (`createAskableCartSource`, `createAskableMultistepSource`).

## Cart source

```tsx
import { useAskableCartSource } from '@askable-ui/react';

function CartWidget() {
  const { snapshot, addItem, updateQuantity, removeItem, setTotals, clearCart } =
    useAskableCartSource({
      items: [{ id: 'sku-1', name: 'T-Shirt', price: 29.99, quantity: 1 }],
      totals: { currency: 'USD', tax: 2.4, shipping: 5 },
    });

  return (
    <div>
      <p>{snapshot?.totalQuantity} items — {snapshot?.total} {snapshot?.currency}</p>
      <button onClick={() => addItem({ id: 'sku-2', name: 'Mug', price: 12, quantity: 1 })}>
        Add mug
      </button>
      <button onClick={() => updateQuantity('sku-1', 3)}>Set qty 3</button>
      <button onClick={() => clearCart()}>Clear</button>
    </div>
  );
}
```

### Mutators

| Method | Description |
|---|---|
| `addItem(item)` | Add or update a line item (matched by `id`). |
| `removeItem(id)` | Remove a line item. |
| `updateQuantity(id, qty)` | Set quantity; removes the item when `qty ≤ 0`. |
| `setItems(items)` | Replace all items at once. |
| `setTotals(totals)` | Update `discount` / `tax` / `shipping` / `currency` / `couponCode`. |
| `clearCart()` | Empty the cart. |

### Snapshot

The AI sees a computed `AskableCartSourceSnapshot` — you only provide items and totals; everything else is derived:

| Field | Meaning |
|---|---|
| `items` | All line items |
| `itemCount` | Number of distinct line items |
| `totalQuantity` | Sum of all quantities |
| `subtotal` | `price × quantity` summed, before adjustments |
| `discount` / `tax` / `shipping` | Adjustments you supplied via `totals` |
| `total` | `subtotal − discount + tax + shipping` |
| `currency` | Currency code (default `"USD"`) |
| `couponCode` | Applied promo code, or `null` |
| `isEmpty` | Whether the cart has no items |
| `lastModifiedAt` | ISO timestamp of the last change |

An `AskableCartItem` is `{ id, name, price, quantity }` plus optional `category`, `variant`, `imageUrl`, and `meta`.

## Multistep (wizard / stepper) source

```tsx
import { useAskableMultistepSource } from '@askable-ui/react';

function Checkout() {
  const { snapshot, next, prev, goTo, complete, setError, reset } =
    useAskableMultistepSource({
      steps: [
        { id: 'cart', label: 'Cart' },
        { id: 'shipping', label: 'Shipping' },
        { id: 'payment', label: 'Payment' },
        { id: 'confirm', label: 'Confirm', optional: false },
      ],
      initialStep: 0,
    });

  return (
    <div>
      <p>
        Step {(snapshot?.currentIndex ?? 0) + 1} of {snapshot?.totalSteps}
        {' — '}{snapshot?.progressPercent}% complete
      </p>
      <button onClick={() => prev()} disabled={snapshot?.isFirstStep}>Back</button>
      <button onClick={() => complete()}>
        {snapshot?.isLastStep ? 'Finish' : 'Continue'}
      </button>
    </div>
  );
}
```

### Navigation

| Method | Description |
|---|---|
| `next()` / `prev()` | Move the active step forward / back. |
| `goTo(index)` | Jump to a specific step. |
| `complete()` | Mark the current step complete and advance to the next. |
| `setError(message \| null)` | Attach (or clear) a validation error on the current step. |
| `reset()` | Return the flow to its initial state. |

### Snapshot

`AskableMultistepSourceSnapshot` gives the AI the full picture of progress:

| Field | Meaning |
|---|---|
| `steps` | All steps in order, each with `completed` / `active` / `error` |
| `currentIndex` | 0-based index of the active step |
| `totalSteps` / `completedCount` | Counts |
| `progressPercent` | Completion as 0–100 |
| `isFirstStep` / `isLastStep` | Position flags |
| `isComplete` | Whether the whole flow is done |
| `startedAt` / `completedAt` | ISO timestamps |

A step is `{ id, label, completed, active }` plus optional `description`, `optional`, and `error`.

## Without a framework

Both are plain core factories you can register on a context directly — useful in vanilla JS or on the server:

```ts
import { createAskableContext, createAskableCartSource } from '@askable-ui/core';

const ctx = createAskableContext();
let snapshot = /* build/track your cart snapshot */;

ctx.registerSource('cart', createAskableCartSource({ getSnapshot: () => snapshot }));
```

The framework hooks are thin wrappers that manage this snapshot and registration for you. See [Custom Sources](/guide/sources) for the underlying source model, and each [framework guide](/guide/react) for the full hook list — `useAskableCartSource` and `useAskableMultistepSource` exist in React, Vue, Svelte, Solid, and Qwik.
