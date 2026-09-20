# @askable-ui/angular

Angular services and a standalone directive for **askable-ui**. Give AI
assistants approved context about what users see, select, and do.

```bash
npm install @askable-ui/angular @askable-ui/core
```

## Development compatibility

The development toolchain uses Angular 21.2.23, Angular build 21.2.24,
TypeScript 5.9.3, Analog 2.7.2, and Zone.js 0.16.x. Use Node 20.19+ or
Node 22.13+ within those major versions for the build and test suite. The
published Angular peer range is unchanged; upgrading the development
dependencies does not certify every older Angular peer version.

Angular 21 is the Node 20-compatible LTS target. Angular 20 has a shorter
remaining support window, while Angular 22 requires Node 22.22.3 or newer.
See Angular's [version compatibility](https://angular.dev/reference/versions)
and [release support schedule](https://angular.dev/reference/releases).
Angular 21.2.23 includes the fixes for
[host-binding sanitization](https://github.com/angular/angular/security/advisories/GHSA-hh8m-fm6v-7cvg)
and [HTTP transfer-cache disclosure](https://github.com/angular/angular/security/advisories/GHSA-p297-fm68-3q8c),
which are not backported to Angular 19.

From the repository root:

```bash
npm ci
npm run build -w @askable-ui/angular
npm test -w @askable-ui/angular
```

The package still emits plain TypeScript-compiled decorators, not Angular
partial-compilation metadata. The dashboard example explicitly uses JIT
compilation to consume this format. AOT packaging remains a separate change;
this dependency upgrade does not claim to add AOT consumer support.

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
