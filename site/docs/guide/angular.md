# Angular Guide

Requires Angular 16 or later (signals-compatible).

## Install

```bash
npm install @askable-ui/angular @askable-ui/core
```

## Quick start

```ts
// app.component.ts
import { Component, inject } from '@angular/core';
import { AskableService, AskableDirective } from '@askable-ui/angular';

@Component({
  standalone: true,
  imports: [AskableDirective],
  template: `
    <div [askable]="{ metric: 'revenue', value: '$128k', period: 'Q3' }">
      <revenue-chart />
    </div>

    <button (click)="ask()">Ask AI ✦</button>
  `,
})
export class DashboardComponent {
  private askable = inject(AskableService);

  ask() {
    const context = this.askable.toPromptContext();
    // pass context to your LLM call
  }
}
```

## `AskableDirective`

A standalone directive that sets the `data-askable` attribute on any host element. Import it into standalone components or an `NgModule`.

```ts
import { AskableDirective } from '@askable-ui/angular';

@Component({
  standalone: true,
  imports: [AskableDirective],
  template: `
    <!-- Object meta — JSON-serialized automatically -->
    <div [askable]="{ widget: 'churn-rate', value: '4.2%' }">
      <churn-chart />
    </div>

    <!-- String meta — passed through as-is -->
    <nav askable="main navigation">...</nav>
  `,
})
```

**Inputs:**

| Input | Type | Description |
|---|---|---|
| `[askable]` | `Record<string, unknown> \| string` | Metadata for the element. Objects are JSON-serialized to `data-askable`. |

## `AskableService`

Injectable service provided at the root injector. Wraps an `AskableContext` and exposes reactive Angular signals.

```ts
import { Component, inject } from '@angular/core';
import { AskableService } from '@askable-ui/angular';

@Component({ ... })
export class MyComponent {
  askable = inject(AskableService);

  // focus: Signal<AskableFocus | null>
  // promptContext: Signal<string>
}
```

```html
<!-- Template — signals unwrap automatically in Angular templates -->
<p>{{ askable.promptContext() }}</p>
<p *ngIf="askable.focus()">Focused: {{ askable.focus()?.meta | json }}</p>
```

**Signals:**

| Signal | Type | Description |
|---|---|---|
| `focus` | `Signal<AskableFocus \| null>` | Current focus, or `null` |
| `promptContext` | `Signal<string>` | Current focus as a prompt-ready string |

**Methods:**

| Method | Description |
|---|---|
| `observe(root?, options?)` | Re-observe a subtree or change options. `root` defaults to `document`. |
| `unobserve()` | Detach all listeners without destroying the context. |
| `toPromptContext(options?)` | Serialize focus to a string with custom options. |
| `ctx` | The underlying `AskableContext` for advanced use. |

## Scoped service

To use a service scoped to a single component (for example, to track only a specific subtree or use custom options), provide a new instance at the component level:

```ts
import { Component } from '@angular/core';
import { AskableService } from '@askable-ui/angular';

@Component({
  standalone: true,
  providers: [
    {
      provide: AskableService,
      useFactory: () =>
        new AskableService({
          textExtractor: (el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
        }),
    },
  ],
})
export class AdminPanelComponent {
  // This instance is independent of the root AskableService
}
```

## SSR

`AskableService` is SSR-safe — it skips `observe()` when `document` is not available (i.e. on the server).

## "Ask AI" button pattern

```ts
@Component({
  standalone: true,
  imports: [AskableDirective],
  template: `
    <div #card [askable]="data">
      <revenue-chart [data]="data" />
      <button (click)="askAboutCard(card)">Ask AI ✦</button>
    </div>
  `,
})
export class RevenueCardComponent {
  data = { metric: 'revenue', value: '$2.3M', period: 'Q3' };
  private askable = inject(AskableService);

  askAboutCard(el: HTMLElement) {
    this.askable.ctx.select(el);
    this.openChatPanel();
  }
}
```
