import { describe, it, expect } from 'vitest';
import { createAskableCartSource, buildCartSnapshot } from '../cart-source.js';
import { createAskableContext } from '../index.js';
import type { AskableCartItem } from '../cart-source.js';

const shirt: AskableCartItem = { id: 'sku-001', name: 'Blue Shirt', price: 29.99, quantity: 2, category: 'apparel', variant: 'Size: M' };
const mug: AskableCartItem = { id: 'sku-002', name: 'Coffee Mug', price: 14.99, quantity: 1 };

describe('buildCartSnapshot', () => {
  it('returns empty cart when no items', () => {
    const snap = buildCartSnapshot([]);
    expect(snap.isEmpty).toBe(true);
    expect(snap.itemCount).toBe(0);
    expect(snap.totalQuantity).toBe(0);
    expect(snap.subtotal).toBe(0);
    expect(snap.total).toBe(0);
  });

  it('computes subtotal, quantity, and total correctly', () => {
    const snap = buildCartSnapshot([shirt, mug]);
    expect(snap.itemCount).toBe(2);
    expect(snap.totalQuantity).toBe(3);
    expect(snap.subtotal).toBeCloseTo(74.97);
    expect(snap.total).toBeCloseTo(74.97);
    expect(snap.isEmpty).toBe(false);
  });

  it('applies discount to total', () => {
    const snap = buildCartSnapshot([shirt], { discount: 10 });
    expect(snap.discount).toBe(10);
    expect(snap.total).toBeCloseTo(49.98);
  });

  it('applies tax and shipping', () => {
    const snap = buildCartSnapshot([mug], { tax: 1.5, shipping: 5 });
    expect(snap.tax).toBe(1.5);
    expect(snap.shipping).toBe(5);
    expect(snap.total).toBeCloseTo(21.49);
  });

  it('stores coupon code', () => {
    const snap = buildCartSnapshot([shirt], { discount: 5, couponCode: 'SAVE5' });
    expect(snap.couponCode).toBe('SAVE5');
    expect(snap.discount).toBe(5);
  });

  it('defaults currency to USD', () => {
    const snap = buildCartSnapshot([]);
    expect(snap.currency).toBe('USD');
  });

  it('total is clamped to zero when discount exceeds subtotal', () => {
    const snap = buildCartSnapshot([mug], { discount: 100 });
    expect(snap.total).toBe(0);
  });

  it('stores lastModifiedAt', () => {
    const ts = new Date().toISOString();
    const snap = buildCartSnapshot([], {}, ts);
    expect(snap.lastModifiedAt).toBe(ts);
  });
});

describe('createAskableCartSource', () => {
  it('registers with kind "cart"', () => {
    const snap = buildCartSnapshot([shirt]);
    const source = createAskableCartSource({ getSnapshot: () => snap });
    expect(source.kind).toBe('cart');
  });

  it('returns null data when snapshot is null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('cart', createAskableCartSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('cart');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('describe returns empty cart message for empty cart', () => {
    const source = createAskableCartSource({ getSnapshot: () => buildCartSnapshot([]) });
    expect(source.describe?.()).toBe('Cart is empty.');
  });

  it('describe includes item names and total', () => {
    const snap = buildCartSnapshot([shirt, mug]);
    const source = createAskableCartSource({ getSnapshot: () => snap });
    const desc = source.describe?.() ?? '';
    expect(desc).toContain('Blue Shirt');
    expect(desc).toContain('Coffee Mug');
    expect(desc).toContain('Total:');
  });

  it('describe shows discount and coupon code', () => {
    const snap = buildCartSnapshot([shirt], { discount: 10, couponCode: 'SAVE10' });
    const source = createAskableCartSource({ getSnapshot: () => snap });
    const desc = source.describe?.() ?? '';
    expect(desc).toContain('Discount:');
    expect(desc).toContain('SAVE10');
  });

  it('describe shows tax and shipping', () => {
    const snap = buildCartSnapshot([mug], { tax: 1.5, shipping: 4.99 });
    const source = createAskableCartSource({ getSnapshot: () => snap });
    const desc = source.describe?.() ?? '';
    expect(desc).toContain('Tax:');
    expect(desc).toContain('Shipping:');
  });

  it('respects custom describe', () => {
    const snap = buildCartSnapshot([shirt]);
    const source = createAskableCartSource({ getSnapshot: () => snap, describe: () => 'custom' });
    expect(source.describe?.()).toBe('custom');
  });

  it('respects custom kind', () => {
    const source = createAskableCartSource({ getSnapshot: () => null, kind: 'basket' });
    expect(source.kind).toBe('basket');
  });
});
