import { createAskableCartSource, buildCartSnapshot } from '@askable-ui/core';
import type {
  AskableCreateCartSourceOptions,
  AskableCartItem,
  AskableCartSourceSnapshot,
  AskableCartTotals,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableCartItem, AskableCartSourceSnapshot, AskableCartTotals };

export interface UseAskableCartSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateCartSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "cart". */
  id?: string;
  /** Initial cart items. */
  items?: AskableCartItem[];
  /** Initial totals (discount, tax, shipping, currency, couponCode). */
  totals?: AskableCartTotals;
}

export interface UseAskableCartSource extends UseAskableSource {
  readonly snapshot: AskableCartSourceSnapshot | null;
  addItem: (item: AskableCartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setItems: (items: AskableCartItem[]) => void;
  setTotals: (totals: AskableCartTotals) => void;
  clearCart: () => void;
}

/**
 * Svelte 5 runes-based composable that tracks shopping cart state and exposes
 * it to AI assistants so they can answer questions about cart contents and totals.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableCartSource } from '@askable-ui/svelte/useAskableCartSource.svelte';
 *   const { snapshot, addItem, clearCart } = useAskableCartSource({
 *     items: [{ id: 'sku-1', name: 'T-Shirt', price: 29.99, quantity: 1 }],
 *   });
 * </script>
 * ```
 */
export function useAskableCartSource(
  options: UseAskableCartSourceOptions = {},
): UseAskableCartSource {
  const { id = 'cart', items: initialItems = [], totals: initialTotals = {}, describe, kind, observe, enabled, ...ctxOptions } = options;

  let snapshot = $state<AskableCartSourceSnapshot | null>(
    buildCartSnapshot(initialItems, initialTotals, new Date().toISOString()),
  );

  const cartSource = createAskableCartSource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...cartSource, ...ctxOptions, observe, enabled });

  function getTotals(): AskableCartTotals {
    return snapshot
      ? { discount: snapshot.discount, tax: snapshot.tax, shipping: snapshot.shipping, currency: snapshot.currency, couponCode: snapshot.couponCode }
      : {};
  }

  function addItem(item: AskableCartItem): void {
    if (!snapshot) return;
    const idx = snapshot.items.findIndex((i) => i.id === item.id);
    const items = idx >= 0 ? snapshot.items.map((i, k) => (k === idx ? item : i)) : [...snapshot.items, item];
    snapshot = buildCartSnapshot(items, getTotals(), new Date().toISOString());
    result.notifyChanged();
  }

  function removeItem(id: string): void {
    if (!snapshot) return;
    snapshot = buildCartSnapshot(snapshot.items.filter((i) => i.id !== id), getTotals(), new Date().toISOString());
    result.notifyChanged();
  }

  function updateQuantity(id: string, quantity: number): void {
    if (!snapshot) return;
    const items = quantity <= 0
      ? snapshot.items.filter((i) => i.id !== id)
      : snapshot.items.map((i) => (i.id === id ? { ...i, quantity } : i));
    snapshot = buildCartSnapshot(items, getTotals(), new Date().toISOString());
    result.notifyChanged();
  }

  function setItems(items: AskableCartItem[]): void {
    snapshot = buildCartSnapshot(items, getTotals(), new Date().toISOString());
    result.notifyChanged();
  }

  function setTotals(totals: AskableCartTotals): void {
    if (!snapshot) return;
    snapshot = buildCartSnapshot(snapshot.items, totals, new Date().toISOString());
    result.notifyChanged();
  }

  function clearCart(): void {
    const currency = snapshot?.currency ?? 'USD';
    snapshot = buildCartSnapshot([], { discount: 0, tax: 0, shipping: 0, currency, couponCode: null }, new Date().toISOString());
    result.notifyChanged();
  }

  return { ...result, addItem, removeItem, updateQuantity, setItems, setTotals, clearCart, get snapshot() { return snapshot; } };
}
