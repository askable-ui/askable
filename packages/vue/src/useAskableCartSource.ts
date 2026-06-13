import { ref, type MaybeRef } from 'vue';
import { createAskableCartSource, buildCartSnapshot } from '@askable-ui/core';
import type {
  AskableCreateCartSourceOptions,
  AskableCartItem,
  AskableCartSourceSnapshot,
  AskableCartTotals,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

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
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableCartSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableCartSourceSnapshot | null>>;
  addItem: (item: AskableCartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setItems: (items: AskableCartItem[]) => void;
  setTotals: (totals: AskableCartTotals) => void;
  clearCart: () => void;
}

/**
 * Vue composable that tracks shopping cart state and exposes it to AI assistants
 * so they can answer questions about cart contents and totals.
 *
 * @example
 * ```ts
 * const { snapshot, addItem, clearCart } = useAskableCartSource({
 *   items: [{ id: 'sku-1', name: 'T-Shirt', price: 29.99, quantity: 1 }],
 * });
 * ```
 */
export function useAskableCartSource(
  options: UseAskableCartSourceOptions = {},
): UseAskableCartSourceResult {
  const { id = 'cart', items: initialItems = [], totals: initialTotals = {}, describe, kind, enabled, ctx, name, events } = options;

  const snapshot = ref<AskableCartSourceSnapshot | null>(
    buildCartSnapshot(initialItems, initialTotals, new Date().toISOString()),
  );

  const source = createAskableCartSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function getTotals() {
    const s = snapshot.value;
    return s ? { discount: s.discount, tax: s.tax, shipping: s.shipping, currency: s.currency, couponCode: s.couponCode } : {};
  }

  function addItem(item: AskableCartItem): void {
    if (!snapshot.value) return;
    const items = snapshot.value.items;
    const idx = items.findIndex((i) => i.id === item.id);
    const next = idx >= 0 ? items.map((i, k) => (k === idx ? item : i)) : [...items, item];
    snapshot.value = buildCartSnapshot(next, getTotals(), new Date().toISOString());
    result.notifyChanged();
  }

  function removeItem(id: string): void {
    if (!snapshot.value) return;
    snapshot.value = buildCartSnapshot(snapshot.value.items.filter((i) => i.id !== id), getTotals(), new Date().toISOString());
    result.notifyChanged();
  }

  function updateQuantity(id: string, quantity: number): void {
    if (!snapshot.value) return;
    const items = quantity <= 0
      ? snapshot.value.items.filter((i) => i.id !== id)
      : snapshot.value.items.map((i) => (i.id === id ? { ...i, quantity } : i));
    snapshot.value = buildCartSnapshot(items, getTotals(), new Date().toISOString());
    result.notifyChanged();
  }

  function setItems(items: AskableCartItem[]): void {
    if (!snapshot.value) return;
    snapshot.value = buildCartSnapshot(items, getTotals(), new Date().toISOString());
    result.notifyChanged();
  }

  function setTotals(totals: AskableCartTotals): void {
    if (!snapshot.value) return;
    snapshot.value = buildCartSnapshot(snapshot.value.items, totals, new Date().toISOString());
    result.notifyChanged();
  }

  function clearCart(): void {
    const currency = snapshot.value?.currency ?? 'USD';
    snapshot.value = buildCartSnapshot([], { discount: 0, tax: 0, shipping: 0, currency, couponCode: null }, new Date().toISOString());
    result.notifyChanged();
  }

  return { ...result, snapshot, addItem, removeItem, updateQuantity, setItems, setTotals, clearCart };
}
