import { useCallback, useMemo, useRef, useState } from 'react';
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
  /** Current cart snapshot. */
  snapshot: AskableCartSourceSnapshot | null;
  /** Add or update an item (matched by id). */
  addItem: (item: AskableCartItem) => void;
  /** Remove an item by id. */
  removeItem: (id: string) => void;
  /** Update quantity for an item by id. Removes the item if quantity ≤ 0. */
  updateQuantity: (id: string, quantity: number) => void;
  /** Replace all items at once. */
  setItems: (items: AskableCartItem[]) => void;
  /** Update totals (discount, tax, shipping, currency, couponCode). */
  setTotals: (totals: AskableCartTotals) => void;
  /** Remove all items from the cart. */
  clearCart: () => void;
}

/**
 * React hook that tracks shopping cart state and exposes it to AI assistants
 * so they can answer questions like "What's in my cart?" and "What's the total?"
 *
 * @example
 * ```tsx
 * const { snapshot, addItem, removeItem, updateQuantity } = useAskableCartSource({
 *   items: [{ id: 'sku-1', name: 'T-Shirt', price: 29.99, quantity: 1 }],
 * });
 * // AI: "You have 1 item in your cart totalling $29.99."
 * ```
 */
export function useAskableCartSource(
  options: UseAskableCartSourceOptions = {},
): UseAskableCartSourceResult {
  const { id = 'cart', items: initialItems = [], totals: initialTotals = {}, describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = useState<AskableCartSourceSnapshot | null>(() =>
    buildCartSnapshot(initialItems, initialTotals, new Date().toISOString()),
  );
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () => createAskableCartSource({ describe, kind, getSnapshot: () => snapshotRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });
  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  const updateSnapshot = useCallback((updater: (prev: AskableCartSourceSnapshot) => AskableCartSourceSnapshot) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
    notifyRef.current();
  }, []);

  const addItem = useCallback((item: AskableCartItem) => {
    updateSnapshot((prev) => {
      const existing = prev.items.findIndex((i) => i.id === item.id);
      const items = existing >= 0
        ? prev.items.map((i, idx) => (idx === existing ? item : i))
        : [...prev.items, item];
      return buildCartSnapshot(items, { discount: prev.discount, tax: prev.tax, shipping: prev.shipping, currency: prev.currency, couponCode: prev.couponCode }, new Date().toISOString());
    });
  }, [updateSnapshot]);

  const removeItem = useCallback((id: string) => {
    updateSnapshot((prev) => {
      const items = prev.items.filter((i) => i.id !== id);
      return buildCartSnapshot(items, { discount: prev.discount, tax: prev.tax, shipping: prev.shipping, currency: prev.currency, couponCode: prev.couponCode }, new Date().toISOString());
    });
  }, [updateSnapshot]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    updateSnapshot((prev) => {
      const items = quantity <= 0
        ? prev.items.filter((i) => i.id !== id)
        : prev.items.map((i) => (i.id === id ? { ...i, quantity } : i));
      return buildCartSnapshot(items, { discount: prev.discount, tax: prev.tax, shipping: prev.shipping, currency: prev.currency, couponCode: prev.couponCode }, new Date().toISOString());
    });
  }, [updateSnapshot]);

  const setItems = useCallback((items: AskableCartItem[]) => {
    updateSnapshot((prev) =>
      buildCartSnapshot(items, { discount: prev.discount, tax: prev.tax, shipping: prev.shipping, currency: prev.currency, couponCode: prev.couponCode }, new Date().toISOString()),
    );
  }, [updateSnapshot]);

  const setTotals = useCallback((totals: AskableCartTotals) => {
    updateSnapshot((prev) =>
      buildCartSnapshot(prev.items, totals, new Date().toISOString()),
    );
  }, [updateSnapshot]);

  const clearCart = useCallback(() => {
    updateSnapshot((prev) =>
      buildCartSnapshot([], { discount: 0, tax: 0, shipping: 0, currency: prev.currency, couponCode: null }, new Date().toISOString()),
    );
  }, [updateSnapshot]);

  return { ...result, snapshot, addItem, removeItem, updateQuantity, setItems, setTotals, clearCart };
}
