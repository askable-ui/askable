# Angular Guide

## Install

```bash
npm install @askable-ui/angular @askable-ui/core
```

## Quick start

Inject `AskableService` into any component and apply the `[askable]` directive to annotate elements.

```ts
// app.component.ts
import { Component, inject } from '@angular/core';
import { AskableService } from '@askable-ui/angular';
import { AskableDirective } from '@askable-ui/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AskableDirective],
  template: `
    <div [askable]="{ metric: 'revenue', value: revenue, period: 'Q3' }">
      <revenue-chart [value]="revenue" />
    </div>

    <button (click)="askAI()">Ask AI</button>
  `,
})
export class AppComponent {
  revenue = '$128k';
  private readonly askable = inject(AskableService);

  async askAI() {
    const prompt = this.askable.promptContext();
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `UI context: ${prompt}` },
          { role: 'user', content: 'What is the user looking at?' },
        ],
      }),
    });
  }
}
```

## `AskableService`

Provided at root by default — one context instance per app. Inject it anywhere to read focus and prompt context.

```ts
import { inject } from '@angular/core';
import { AskableService } from '@askable-ui/angular';

class MyComponent {
  private readonly askable = inject(AskableService);

  // Reactive Angular signal — use in templates with promptContext()
  promptContext = this.askable.promptContext;

  // Current focus signal
  focus = this.askable.focus;

  // Raw AskableContext for advanced usage
  ctx = this.askable.context;
}
```

### Signals

| Signal | Type | Description |
|---|---|---|
| `promptContext` | `Signal<string>` | Serialized prompt string for the current focus |
| `focus` | `Signal<AskableFocus \| null>` | Current focused element metadata |

### Methods

| Method | Description |
|---|---|
| `context` | Raw `AskableContext` — for agent requests, region capture, etc. |

### Use `promptContext` in a template

```html
<p>{{ askable.promptContext() }}</p>
```

Because `promptContext` is a Signal, Angular automatically rerenders only the affected part when focus changes.

## `[askable]` directive

Apply to any element to annotate it with context metadata.

```html
<!-- Object meta -->
<div [askable]="{ widget: 'churn-rate', value: '4.2%' }">
  <churn-chart />
</div>

<!-- String meta -->
<section askable="pricing page hero">
  <hero-section />
</section>

<!-- With scope -->
<div [askable]="{ chart: 'revenue' }" askableScope="dashboard">
  <revenue-chart />
</div>
```

## `AskableModule` (NgModule apps)

For apps that use NgModules instead of standalone components, import `AskableModule`:

```ts
import { NgModule } from '@angular/core';
import { AskableModule } from '@askable-ui/angular';

@NgModule({
  imports: [AskableModule],
  // ...
})
export class AppModule {}
```

Then use `[askable]` in any template within the module.

## Sources

Sources expose app state (cart contents, multistep progress, form data, etc.) to the AI. Each source is an Angular injectable service.

### Cart source

```ts
import { Component, inject, OnInit } from '@angular/core';
import { AskableCartSourceService } from '@askable-ui/angular';
import type { AskableCartItem } from '@askable-ui/angular';

@Component({
  selector: 'app-cart',
  standalone: true,
  providers: [AskableCartSourceService],
  template: `
    <p>{{ cart.snapshot?.itemCount }} items — {{ cart.snapshot?.total | currency }}</p>
  `,
})
export class CartComponent implements OnInit {
  readonly cart = inject(AskableCartSourceService);

  ngOnInit() {
    this.cart.init({
      items: [],
      totals: { currency: 'USD' },
    });
  }

  addItem(item: AskableCartItem) {
    this.cart.addItem(item);
  }

  removeItem(id: string) {
    this.cart.removeItem(id);
  }

  checkout() {
    this.cart.clearCart();
  }
}
```

### Multistep / wizard source

```ts
import { Component, inject, OnInit } from '@angular/core';
import { AskableMultistepSourceService } from '@askable-ui/angular';

@Component({
  selector: 'app-checkout',
  standalone: true,
  providers: [AskableMultistepSourceService],
  template: `
    <p>Step {{ wizard.snapshot?.currentIndex + 1 }} of {{ wizard.snapshot?.totalSteps }}</p>
    <button (click)="wizard.next()">Next</button>
    <button (click)="wizard.prev()">Back</button>
  `,
})
export class CheckoutComponent implements OnInit {
  readonly wizard = inject(AskableMultistepSourceService);

  ngOnInit() {
    this.wizard.init({
      steps: [
        { id: 'cart',     label: 'Cart' },
        { id: 'shipping', label: 'Shipping' },
        { id: 'payment',  label: 'Payment' },
        { id: 'confirm',  label: 'Confirm' },
      ],
    });
  }
}
```

### Other sources

All sources follow the same `inject → init()` pattern:

| Service | Purpose |
|---|---|
| `AskablePageSourceService` | Current page title, URL, description |
| `AskableFormSourceService` | Form field values and validation state |
| `AskableTableSourceService` | Table rows, columns, selection |
| `AskableNavigationSourceService` | Route history |
| `AskableUserSourceService` | Authenticated user info |
| `AskableNotificationSourceService` | Active toasts and alerts |
| `AskableErrorSourceService` | Recent errors |
| `AskableLoadingSourceService` | Loading/pending states |
| `AskableSearchSourceService` | Search query and results |

## Agent requests

Use `context.toAgentRequest()` to send a structured request that includes the full context packet:

```ts
async askAI(question: string) {
  const req = await this.askable.context.toAgentRequest(question, {
    history: 3,
    packet: true,
  });

  await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}
```

## Region and text selection capture

Region and text selection capture use the raw `AskableContext` directly:

```ts
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { createAskableRegionCapture } from '@askable-ui/core';
import type { AskableRegionCaptureHandle } from '@askable-ui/core';
import { AskableService } from '@askable-ui/angular';

@Component({ selector: 'app-annotate', standalone: true, template: `
  <button (click)="startCapture()">Mark region</button>
` })
export class AnnotateComponent implements OnDestroy {
  private readonly askable = inject(AskableService);
  private captureHandle: AskableRegionCaptureHandle | null = null;

  startCapture() {
    this.captureHandle?.destroy();
    this.captureHandle = createAskableRegionCapture(this.askable.context, {
      shape: 'rect',
      onCapture: (packet) => {
        console.log('Region captured:', packet.text);
      },
    });
    this.captureHandle.start();
  }

  ngOnDestroy() {
    this.captureHandle?.destroy();
  }
}
```

## Server-side rendering

`AskableService` checks `typeof document !== 'undefined'` before observing the DOM, so it is safe to use in Angular Universal / SSR apps. The service constructor is a no-op on the server and activates automatically in the browser.
