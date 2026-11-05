import { Component, NgModule, inject } from '@angular/core';
import { AskableModule, AskableService, AskableUserSourceService } from '@askable-ui/angular';

// Compile-only coverage for applications that import AskableModule rather than
// the standalone directive used by the dashboard. Always resolve the installed
// package: do not add workspace source aliases to this fixture.
@Component({
  selector: 'askable-aot-ngmodule-consumer',
  standalone: false,
  template: '<button [askable]="{ metric: \'revenue\', value: 123 }" askableScope="aot">Revenue</button>',
  providers: [AskableUserSourceService],
})
export class NgModuleConsumerComponent {
  readonly askable = inject(AskableService);
  readonly userSource = inject(AskableUserSourceService);
}

@NgModule({
  declarations: [NgModuleConsumerComponent],
  imports: [AskableModule],
})
export class NgModuleConsumerModule {}
