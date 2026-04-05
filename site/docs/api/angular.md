# @askable-ui/angular

Angular bindings for askable-ui. Requires Angular 16 or later.

## Install

```bash
npm install @askable-ui/angular @askable-ui/core
```

---

## `AskableDirective`

Standalone directive that sets `data-askable` on a host element. Import it in standalone components or an `NgModule`.

```ts
import { AskableDirective } from '@askable-ui/angular';

@Component({
  standalone: true,
  imports: [AskableDirective],
  template: `
    <div [askable]="{ metric: 'revenue', delta: '-12%' }">
      <revenue-chart />
    </div>
    <nav askable="main navigation">...</nav>
  `,
})
```

**Inputs:**

| Input | Type | Description |
|---|---|---|
| `[askable]` | `Record<string, unknown> \| string` | Value for `data-askable`. Objects are JSON-serialized. |

---

## `AskableService`

Injectable service (provided at root by default) wrapping an `AskableContext`. Exposes Angular signals for reactive integration.

```ts
import { Component, inject } from '@angular/core';
import { AskableService } from '@askable-ui/angular';

@Component({ ... })
export class MyComponent {
  askable = inject(AskableService);
  // askable.focus()         — Signal<AskableFocus | null>
  // askable.promptContext() — Signal<string>
}
```

**Signals:**

| Signal | Type | Description |
|---|---|---|
| `focus` | `Signal<AskableFocus \| null>` | Current focus, or `null` |
| `promptContext` | `Signal<string>` | Current focus as a prompt-ready string |

**Methods:**

| Method | Signature | Description |
|---|---|---|
| `observe` | `(root?: HTMLElement \| Document, options?: AskableObserveOptions) => void` | Re-observe a subtree or change options. Defaults to `document`. |
| `unobserve` | `() => void` | Detach all listeners without destroying the context |
| `toPromptContext` | `(options?: AskablePromptContextOptions) => string` | Serialize focus with custom options |
| `ctx` | `AskableContext` (getter) | The underlying context for advanced use |
| `ngOnDestroy` | `() => void` | Automatically called by Angular — destroys the context |

**Notes:**
- `observe(document)` is called automatically at construction in browser environments. It is skipped on the server (SSR-safe).
- To scope to a specific subtree, call `unobserve()` then `observe(myElement)`.
- To use custom options (`textExtractor`, `sanitizeMeta`, `sanitizeText`), provide a factory at the component level — see the [Angular Guide](/guide/angular#scoped-service).
