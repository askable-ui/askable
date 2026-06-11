import { NgModule } from '@angular/core';
import { AskableDirective } from './askable.directive.js';

/** NgModule for non-standalone Angular apps. Standalone apps can import AskableDirective directly. */
@NgModule({
  imports: [AskableDirective],
  exports: [AskableDirective],
})
export class AskableModule {}
