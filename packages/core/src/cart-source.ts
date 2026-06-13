import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableCartItem {
  /** Unique item identifier (SKU, product ID, etc.). */
  id: string;
  /** Display name of the item. */
  name: string;
  /** Unit price (in the cart's currency). */
  price: number;
  /** Quantity in the cart. */
  quantity: number;
  /** Optional category or product type. */
  category?: string;
  /** Optional variant label (e.g. "Size: L, Color: Blue"). */
  variant?: string;
  /** Optional image URL. */
  imageUrl?: string;
  /** Optional metadata. */
  meta?: Record<string, unknown>;
}

export interface AskableCartSourceSnapshot {
  /** All items currently in the cart. */
  items: AskableCartItem[];
  /** Total number of distinct line items. */
  itemCount: number;
  /** Total number of individual units (sum of quantities). */
  totalQuantity: number;
  /** Subtotal before discounts, tax, and shipping (price × quantity for each item). */
  subtotal: number;
  /** Applied discount amount (if provided). */
  discount: number;
  /** Tax amount (if provided). */
  tax: number;
  /** Shipping cost (if provided). */
  shipping: number;
  /** Grand total (subtotal - discount + tax + shipping). */
  total: number;
  /** Currency code (e.g. "USD"). */
  currency: string;
  /** Applied coupon/promo code, if any. */
  couponCode: string | null;
  /** Whether the cart is empty. */
  isEmpty: boolean;
  /** ISO timestamp of when the cart was last modified. */
  lastModifiedAt: string | null;
}

export interface AskableCartTotals {
  /** Applied discount amount. @default 0 */
  discount?: number;
  /** Tax amount. @default 0 */
  tax?: number;
  /** Shipping cost. @default 0 */
  shipping?: number;
  /** Coupon/promo code. */
  couponCode?: string | null;
  /** Currency code. @default "USD" */
  currency?: string;
}

export function buildCartSnapshot(
  items: AskableCartItem[],
  totals: AskableCartTotals = {},
  lastModifiedAt: string | null = null,
): AskableCartSourceSnapshot {
  const { discount = 0, tax = 0, shipping = 0, couponCode = null, currency = 'USD' } = totals;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = Math.max(0, subtotal - discount + tax + shipping);

  return {
    items,
    itemCount: items.length,
    totalQuantity,
    subtotal,
    discount,
    tax,
    shipping,
    total,
    currency,
    couponCode,
    isEmpty: items.length === 0,
    lastModifiedAt,
  };
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function defaultDescribe(snapshot: AskableCartSourceSnapshot | null): string {
  if (!snapshot) return 'Cart state is unavailable.';
  if (snapshot.isEmpty) return 'Cart is empty.';

  const lines: string[] = [];
  const totalQty = snapshot.totalQuantity;
  lines.push(`Cart has ${snapshot.itemCount} item${snapshot.itemCount !== 1 ? 's' : ''} (${totalQty} unit${totalQty !== 1 ? 's' : ''}).`);

  for (const item of snapshot.items) {
    const price = formatMoney(item.price * item.quantity, snapshot.currency);
    const variantStr = item.variant ? ` (${item.variant})` : '';
    lines.push(`- ${item.name}${variantStr} ×${item.quantity} = ${price}`);
  }

  lines.push(`Subtotal: ${formatMoney(snapshot.subtotal, snapshot.currency)}.`);
  if (snapshot.discount > 0) {
    const couponStr = snapshot.couponCode ? ` (code: ${snapshot.couponCode})` : '';
    lines.push(`Discount: -${formatMoney(snapshot.discount, snapshot.currency)}${couponStr}.`);
  }
  if (snapshot.tax > 0) lines.push(`Tax: ${formatMoney(snapshot.tax, snapshot.currency)}.`);
  if (snapshot.shipping > 0) lines.push(`Shipping: ${formatMoney(snapshot.shipping, snapshot.currency)}.`);
  lines.push(`Total: ${formatMoney(snapshot.total, snapshot.currency)}.`);

  return lines.join('\n');
}

export interface AskableCreateCartSourceOptions {
  /** Custom describe function. */
  describe?: (snapshot: AskableCartSourceSnapshot | null) => string;
  /** Override the source kind label. */
  kind?: string;
  /** Returns the current cart snapshot. */
  getSnapshot: () => AskableCartSourceSnapshot | null;
}

export function createAskableCartSource(options: AskableCreateCartSourceOptions): AskableContextSource {
  const { describe, kind = 'cart', getSnapshot } = options;
  return createAskableSource({
    kind,
    data: getSnapshot,
    describe: describe ? () => describe(getSnapshot()) : () => defaultDescribe(getSnapshot()),
  });
}
