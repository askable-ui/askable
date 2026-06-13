import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableFocus } from '@askable-ui/core';

const HTMLElementBase: typeof HTMLElement = typeof HTMLElement === 'undefined'
  ? class {} as typeof HTMLElement
  : HTMLElement;

/**
 * `<askable-context>` — a zero-dependency custom element that wraps any DOM
 * subtree and captures AI context from `data-askable` annotations inside it.
 *
 * Works in any framework (HTMX, Ember, vanilla HTML) with no build step.
 *
 * @example
 * ```html
 * <askable-context id="main">
 *   <button data-askable='{"action":"buy","sku":"abc"}'>Buy now</button>
 * </askable-context>
 *
 * <script type="module">
 *   import '@askable-ui/web-component';
 *   const el = document.getElementById('main');
 *   el.addEventListener('askable:focus', (e) => {
 *     console.log(e.detail.promptContext);
 *   });
 * </script>
 * ```
 *
 * ### Attributes
 * - `scope` — filter observed elements to a specific `data-askable-scope`
 * - `observe` — set to `"false"` to disable automatic DOM observation
 *
 * ### Events
 * - `askable:focus` — fires when an element is focused; `event.detail = { focus, promptContext }`
 * - `askable:clear` — fires when focus is cleared; `event.detail = { promptContext }`
 *
 * ### Properties
 * - `askableContext` — the underlying `AskableContext` instance
 * - `promptContext` — current prompt string
 * - `currentFocus` — current `AskableFocus | null`
 */
export class AskableContextElement extends HTMLElementBase {
  static observedAttributes = ['scope', 'observe'];

  private _ctx: AskableContext | null = null;
  private _currentFocus: AskableFocus | null = null;
  private _promptContext = '';
  private _focusHandler = (f: AskableFocus) => this._onFocus(f);
  private _clearHandler = (_: null) => this._onClear();

  connectedCallback(): void {
    this._ctx = createAskableContext({ name: this.getAttribute('scope') ?? undefined });
    this._ctx.on('focus', this._focusHandler);
    this._ctx.on('clear', this._clearHandler);

    if (this.getAttribute('observe') !== 'false') {
      this._ctx.observe(this as unknown as HTMLElement);
    }
  }

  disconnectedCallback(): void {
    this._ctx?.off('focus', this._focusHandler);
    this._ctx?.off('clear', this._clearHandler);
    this._ctx?.destroy();
    this._ctx = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (this.isConnected && this._ctx) {
      this.disconnectedCallback();
      this.connectedCallback();
    }
  }

  private _onFocus(f: AskableFocus): void {
    this._currentFocus = f;
    this._promptContext = this._ctx?.toPromptContext() ?? '';
    this.dispatchEvent(
      new CustomEvent('askable:focus', {
        bubbles: true,
        composed: true,
        detail: { focus: f, promptContext: this._promptContext },
      }),
    );
  }

  private _onClear(): void {
    this._currentFocus = null;
    this._promptContext = '';
    this.dispatchEvent(
      new CustomEvent('askable:clear', {
        bubbles: true,
        composed: true,
        detail: { promptContext: '' },
      }),
    );
  }

  /** The underlying AskableContext instance */
  get askableContext(): AskableContext | null {
    return this._ctx;
  }

  /** Current prompt-ready context string */
  get promptContext(): string {
    return this._promptContext;
  }

  /** Current focus or null */
  get currentFocus(): AskableFocus | null {
    return this._currentFocus;
  }
}

/** Register `<askable-context>` as a custom element. Safe to call multiple times. */
export function defineAskableContext(tagName = 'askable-context'): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) {
    customElements.define(tagName, AskableContextElement as unknown as CustomElementConstructor);
  }
}
