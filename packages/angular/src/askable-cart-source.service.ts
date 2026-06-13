import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableCartSource, buildCartSnapshot } from '@askable-ui/core';
import type {
  AskableContextSourceHandle,
  AskableCreateCartSourceOptions,
  AskableCartItem,
  AskableCartSourceSnapshot,
  AskableCartTotals,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableCartItem, AskableCartSourceSnapshot, AskableCartTotals };

export interface AskableCartSourceServiceOptions
  extends Omit<AskableCreateCartSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "cart". */
  id?: string;
  /** Initial cart items. */
  items?: AskableCartItem[];
  /** Initial totals (discount, tax, shipping, currency, couponCode). */
  totals?: AskableCartTotals;
}

/**
 * Angular service that tracks shopping cart state and exposes it to AI
 * assistants so they can answer questions about cart contents and totals.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableCartSourceService] })
 * export class CartComponent implements OnInit {
 *   private readonly cart = inject(AskableCartSourceService);
 *   ngOnInit() {
 *     this.cart.init({ items: [], totals: { currency: 'USD' } });
 *   }
 *   addToCart(item: AskableCartItem) { this.cart.addItem(item); }
 * }
 * ```
 */
@Injectable()
export class AskableCartSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'cart';
  private _snapshot: AskableCartSourceSnapshot | null = null;

  readonly isRegistered = signal<boolean>(false);

  get snapshot(): AskableCartSourceSnapshot | null { return this._snapshot; }
  get sourceId(): string { return this._sourceId; }

  init(options: AskableCartSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'cart', items = [], totals = {}, describe, kind } = options;
    this._sourceId = id;
    this._snapshot = buildCartSnapshot(items, totals, new Date().toISOString());

    const source = createAskableCartSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.askable.context.registerSource(id, source);
    this.isRegistered.set(true);
  }

  private _getTotals(): AskableCartTotals {
    const s = this._snapshot;
    return s ? { discount: s.discount, tax: s.tax, shipping: s.shipping, currency: s.currency, couponCode: s.couponCode } : {};
  }

  addItem(item: AskableCartItem): void {
    if (!this._snapshot) return;
    const idx = this._snapshot.items.findIndex((i) => i.id === item.id);
    const items = idx >= 0
      ? this._snapshot.items.map((i, k) => (k === idx ? item : i))
      : [...this._snapshot.items, item];
    this._snapshot = buildCartSnapshot(items, this._getTotals(), new Date().toISOString());
    this.notifyChanged();
  }

  removeItem(id: string): void {
    if (!this._snapshot) return;
    this._snapshot = buildCartSnapshot(this._snapshot.items.filter((i) => i.id !== id), this._getTotals(), new Date().toISOString());
    this.notifyChanged();
  }

  updateQuantity(id: string, quantity: number): void {
    if (!this._snapshot) return;
    const items = quantity <= 0
      ? this._snapshot.items.filter((i) => i.id !== id)
      : this._snapshot.items.map((i) => (i.id === id ? { ...i, quantity } : i));
    this._snapshot = buildCartSnapshot(items, this._getTotals(), new Date().toISOString());
    this.notifyChanged();
  }

  setItems(items: AskableCartItem[]): void {
    if (!this._snapshot) return;
    this._snapshot = buildCartSnapshot(items, this._getTotals(), new Date().toISOString());
    this.notifyChanged();
  }

  setTotals(totals: AskableCartTotals): void {
    if (!this._snapshot) return;
    this._snapshot = buildCartSnapshot(this._snapshot.items, totals, new Date().toISOString());
    this.notifyChanged();
  }

  clearCart(): void {
    const currency = this._snapshot?.currency ?? 'USD';
    this._snapshot = buildCartSnapshot([], { discount: 0, tax: 0, shipping: 0, currency, couponCode: null }, new Date().toISOString());
    this.notifyChanged();
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
    return this.askable.context.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.askable.context.toPromptContextAsync({ sources: [{ id: this._sourceId, ...options }] });
  }

  notifyChanged(): void { this.handle?.notifyChanged(); }

  unregister(): void {
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
