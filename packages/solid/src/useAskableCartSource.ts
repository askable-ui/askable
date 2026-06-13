import { createSignal } from 'solid-js';
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
}

export interface UseAskableCartSourceResult extends UseAskableSourceResult {
  snapshot: () => AskableCartSourceSnapshot | null;
  addItem: (item: AskableCartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setItems: (items: AskableCartItem[]) => void;
  setTotals: (totals: AskableCartTotals) => void;
  clearCart: () => void;
}

/**
 * SolidJS primitive that tracks shopping cart state and exposes it to AI
 * assistants so they can answer questions about cart contents and totals.
 *
 * @example
 * ```tsx
 * const { snapshot, addItem, clearCart } = useAskableCartSource({
 *   items: [{ id: 'sku-1', name: 'T-Shirt', price: 29.99, quantity: 1 }],
 * });
 * ```
 */
export function useAskableCartSource(
  options: UseAskableCartSourceOptions = {},
): UseAskableCartSourceResult {
  const { id = 'cart', items: initialItems = [], totals: initialTotals = {}, describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = createSignal<AskableCartSourceSnapshot | null>(
    buildCartSnapshot(initialItems, initialTotals, new Date().toISOString()),
  );

  const source = createAskableCartSource({ describe, kind, getSnapshot: snapshot });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function getTotals(): AskableCartTotals {
    const s = snapshot();
    return s ? { discount: s.discount, tax: s.tax, shipping: s.shipping, currency: s.currency, couponCode: s.couponCode } : {};
  }

  function updateSnapshot(updater: (prev: AskableCartSourceSnapshot) => AskableCartSourceSnapshot): void {
    setSnapshot((prev) => (prev ? updater(prev) : prev));
    result.notifyChanged();
  }

  function addItem(item: AskableCartItem): void {
    updateSnapshot((prev) => {
      const idx = prev.items.findIndex((i) => i.id === item.id);
      const items = idx >= 0 ? prev.items.map((i, k) => (k === idx ? item : i)) : [...prev.items, item];
      return buildCartSnapshot(items, getTotals(), new Date().toISOString());
    });
  }

  function removeItem(id: string): void {
    updateSnapshot((prev) =>
      buildCartSnapshot(prev.items.filter((i) => i.id !== id), getTotals(), new Date().toISOString()),
    );
  }

  function updateQuantity(id: string, quantity: number): void {
    updateSnapshot((prev) => {
      const items = quantity <= 0
        ? prev.items.filter((i) => i.id !== id)
        : prev.items.map((i) => (i.id === id ? { ...i, quantity } : i));
      return buildCartSnapshot(items, getTotals(), new Date().toISOString());
    });
  }

  function setItems(items: AskableCartItem[]): void {
    updateSnapshot((prev) => buildCartSnapshot(items, getTotals(), new Date().toISOString()));
  }

  function setTotals(totals: AskableCartTotals): void {
    updateSnapshot((prev) => buildCartSnapshot(prev.items, totals, new Date().toISOString()));
  }

  function clearCart(): void {
    const currency = snapshot()?.currency ?? 'USD';
    setSnapshot(buildCartSnapshot([], { discount: 0, tax: 0, shipping: 0, currency, couponCode: null }, new Date().toISOString()));
    result.notifyChanged();
  }

  return { ...result, snapshot, addItem, removeItem, updateQuantity, setItems, setTotals, clearCart };
}
