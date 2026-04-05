import { Directive, Input, HostBinding } from '@angular/core';

/**
 * Standalone directive that sets the `data-askable` attribute on a host element.
 *
 * Use it in templates to annotate any element for LLM context:
 *
 * ```html
 * <div [askable]="{ metric: 'revenue', period: 'Q3' }">...</div>
 * <nav askable="main navigation">...</nav>
 * ```
 *
 * The value can be a JSON object (serialized automatically) or a plain string.
 */
@Directive({
  selector: '[askable]',
  standalone: true,
})
export class AskableDirective {
  /** Meta to encode as the `data-askable` attribute. Objects are JSON-serialized. */
  @Input('askable') meta: Record<string, unknown> | string = '';

  @HostBinding('attr.data-askable')
  get dataAskable(): string {
    return typeof this.meta === 'string' ? this.meta : JSON.stringify(this.meta);
  }
}
