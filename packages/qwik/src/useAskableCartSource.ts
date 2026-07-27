import { $, useSignal } from '@builder.io/qwik';
import type { QRL, SyncQRL } from '@builder.io/qwik';
import { createAskableCartSource, buildCartSnapshot } from '@askable-ui/core';
import type {
  AskableCreateCartSourceOptions,
  AskableCartItem,
  AskableCartSourceSnapshot,
  AskableCartTotals,
} from '@askable-ui/core';
import {
  useAskableSource,
  type UseAskableSourceOptions,
  type UseAskableSourceResult,
} from './useAskableSource.js';

export type { AskableCartItem, AskableCartSourceSnapshot, AskableCartTotals };

export interface UseAskableCartSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateCartSourceOptions, 'describe' | 'getSnapshot'> {
  id?: string;
  items?: AskableCartItem[];
  totals?: AskableCartTotals;
  /** Resume-safe synchronous source description callback. */
  describe?: SyncQRL<NonNullable<AskableCreateCartSourceOptions['describe']>>;
}

export interface UseAskableCartSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof useSignal<AskableCartSourceSnapshot | null>>;
  addItem: QRL<(item: AskableCartItem) => Promise<void>>;
  removeItem: QRL<(id: string) => Promise<void>>;
  updateQuantity: QRL<(id: string, quantity: number) => Promise<void>>;
  setItems: QRL<(items: AskableCartItem[]) => Promise<void>>;
  setTotals: QRL<(totals: AskableCartTotals) => Promise<void>>;
  clearCart: QRL<() => Promise<void>>;
}

function totalsFromSnapshot(snapshot: AskableCartSourceSnapshot | null): AskableCartTotals {
  return snapshot
    ? {
        discount: snapshot.discount,
        tax: snapshot.tax,
        shipping: snapshot.shipping,
        currency: snapshot.currency,
        couponCode: snapshot.couponCode,
      }
    : {};
}

/** Qwik hook that tracks shopping cart state and exposes resumable actions. */
export function useAskableCartSource(
  options: UseAskableCartSourceOptions = {},
): UseAskableCartSourceResult {
  const {
    id = 'cart',
    items: initialItems = [],
    totals: initialTotals = {},
    describe,
    kind,
    enabled,
    ctx,
    ctx$,
    name,
    events,
    viewport,
    textExtractor,
    sanitizeMeta,
    sanitizeText,
    sanitizeSource,
    maxHistory,
  } = options;

  const snapshot = useSignal<AskableCartSourceSnapshot | null>(
    buildCartSnapshot(initialItems, initialTotals, new Date().toISOString()),
  );
  const sourceFactory = $(async () => createAskableCartSource({
    describe: await describe?.resolve(),
    kind,
    getSnapshot: () => snapshot.value,
  }));
  const result = useAskableSource(id, sourceFactory, {
    enabled, ctx, ctx$, name, events, viewport, textExtractor,
    sanitizeMeta, sanitizeText, sanitizeSource, maxHistory,
  });
  const notifyChanged = result.notifyChanged;

  const addItem = $(async (item: AskableCartItem): Promise<void> => {
    const previous = snapshot.value;
    if (!previous) return;
    const index = previous.items.findIndex((current) => current.id === item.id);
    const items = index >= 0
      ? previous.items.map((current, currentIndex) => currentIndex === index ? item : current)
      : [...previous.items, item];
    snapshot.value = buildCartSnapshot(
      items,
      totalsFromSnapshot(previous),
      new Date().toISOString(),
    );
    await notifyChanged();
  });

  const removeItem = $(async (itemId: string): Promise<void> => {
    const previous = snapshot.value;
    if (!previous) return;
    snapshot.value = buildCartSnapshot(
      previous.items.filter((item) => item.id !== itemId),
      totalsFromSnapshot(previous),
      new Date().toISOString(),
    );
    await notifyChanged();
  });

  const updateQuantity = $(async (itemId: string, quantity: number): Promise<void> => {
    const previous = snapshot.value;
    if (!previous) return;
    const items = quantity <= 0
      ? previous.items.filter((item) => item.id !== itemId)
      : previous.items.map((item) => item.id === itemId ? { ...item, quantity } : item);
    snapshot.value = buildCartSnapshot(
      items,
      totalsFromSnapshot(previous),
      new Date().toISOString(),
    );
    await notifyChanged();
  });

  const setItems = $(async (items: AskableCartItem[]): Promise<void> => {
    const previous = snapshot.value;
    snapshot.value = buildCartSnapshot(
      items,
      totalsFromSnapshot(previous),
      new Date().toISOString(),
    );
    await notifyChanged();
  });

  const setTotals = $(async (totals: AskableCartTotals): Promise<void> => {
    const previous = snapshot.value;
    if (!previous) return;
    snapshot.value = buildCartSnapshot(
      previous.items,
      totals,
      new Date().toISOString(),
    );
    await notifyChanged();
  });

  const clearCart = $(async (): Promise<void> => {
    const currency = snapshot.value?.currency ?? 'USD';
    snapshot.value = buildCartSnapshot(
      [],
      { discount: 0, tax: 0, shipping: 0, currency, couponCode: null },
      new Date().toISOString(),
    );
    await notifyChanged();
  });

  return Object.assign(result, {
    snapshot,
    addItem,
    removeItem,
    updateQuantity,
    setItems,
    setTotals,
    clearCart,
  });
}
