import { Directive, Input, HostBinding } from '@angular/core';

@Directive({
  selector: '[askable]',
  standalone: true,
})
export class AskableDirective {
  @Input('askable') meta: string | Record<string, unknown> = '';
  @Input('askableScope') scope: string | undefined;

  @HostBinding('attr.data-askable')
  get dataAskable(): string {
    if (!this.meta) return '';
    return typeof this.meta === 'string' ? this.meta : JSON.stringify(this.meta);
  }

  @HostBinding('attr.data-askable-scope')
  get dataAskableScope(): string | undefined {
    return this.scope;
  }
}
