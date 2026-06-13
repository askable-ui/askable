# @askable-ui/angular

Angular services and a standalone directive for **askable-ui**. Give AI
assistants approved context about what users see, select, and do.

```bash
npm install @askable-ui/angular @askable-ui/core
```

## Basic usage

Import the standalone directive and annotate useful UI:

```ts
import { Component, inject } from '@angular/core';
import { AskableDirective, AskableService } from '@askable-ui/angular';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AskableDirective],
  template: `
    <article [askable]="{ metric: 'revenue', value: '$2.34M' }">
      Revenue: $2.34M
    </article>

    <pre>{{ askable.promptContext() }}</pre>
  `,
})
export class DashboardComponent {
  readonly askable = inject(AskableService);
}
```

Use `AskableAgentService` to package the current UI context with a question:

```ts
const agent = inject(AskableAgentService);

await agent.send('Explain this metric', (request) =>
  fetch('/api/ai', {
    method: 'POST',
    body: JSON.stringify(request),
  }).then((response) => response.json()),
);
```

The package also provides injectable services for page, form, navigation,
viewport, history, user, error, media, storage, network, and other app-owned
context sources.

## Links

- [Documentation](https://askable-ui.com/docs/)
- [GitHub](https://github.com/askable-ui/askable)
- [npm](https://www.npmjs.com/package/@askable-ui/angular)
