# askable-ui — Agent Instructions

This file explains how to integrate `askable-ui` correctly. Copy it to your project root so coding agents have accurate, copy-pasteable guidance.

---

## What askable-ui does

`askable-ui` tracks which annotated UI element the user is currently focused on and serialises that focus into a prompt-ready string. You feed that string to your LLM — no manual prompt engineering required.

```
"User is focused on: metric: revenue — value $2.3M, delta +12%"
```

The three moving parts:
1. **Annotate** — add `data-askable` (or wrap with `<Askable>`) to any element whose data is relevant to AI
2. **Observe** — one hook/composable/store call wires the DOM listener
3. **Inject** — pass `promptContext` (or `ctx.toContext()`) into your LLM system prompt

---

## Installation

```bash
# React
npm install @askable-ui/react

# Vue 3
npm install @askable-ui/vue

# Svelte
npm install @askable-ui/svelte

# Vanilla / framework-agnostic
npm install @askable-ui/core
```

---

## Annotating elements

### HTML attribute (vanilla / any framework)

```html
<div data-askable='{"widget":"revenue","value":"$2.3M","delta":"+12%"}'>
  <RevenueChart />
</div>
```

- The value can be a **JSON object** (preferred) or a plain string.
- Only annotate elements whose data is meaningful to an AI answer. Do not annotate every div.

### React component

```tsx
import { Askable } from '@askable-ui/react';

<Askable meta={{ widget: 'revenue', value: '$2.3M', delta: '+12%' }}>
  <RevenueChart data={data} />
</Askable>
```

`<Askable>` keeps `data-askable` in sync with reactive props. Use it whenever `meta` comes from component state or props.

### Nesting and hierarchy

Nested `[data-askable]` elements are automatically chained. Inner elements inherit outer context.

```tsx
<Askable meta={{ section: 'deals' }}>
  <TableContainer>
    <Askable meta={{ row: 3, company: 'Acme', stage: 'Closed Won' }}>
      <TableRow />
    </Askable>
  </TableContainer>
</Askable>
```

When the row is focused the serialized output includes both levels.

### Override extracted text

By default askable-ui extracts `textContent`. Override it when the DOM text is noisy or screen-reader labels are better:

```html
<div data-askable='{"metric":"churn"}' data-askable-text="Monthly churn rate 4.2%">
  <ChurnChart />
</div>

<!-- Suppress text entirely -->
<div data-askable='{"id":42}' data-askable-text="">...</div>
```

### Priority

When two annotated elements overlap, the innermost wins by default. Set `data-askable-priority` to override:

```html
<div data-askable='{"section":"header"}' data-askable-priority="1">
  <div data-askable='{"cta":"upgrade"}' data-askable-priority="10">Upgrade</div>
</div>
```

---

## Passive interaction patterns

Passive patterns fire automatically as the user clicks, hovers, or focuses annotated elements.

### React

```tsx
import { Askable, useAskable } from '@askable-ui/react';

function Dashboard() {
  const { promptContext } = useAskable(); // shared context, all events

  return (
    <>
      <Askable meta={{ widget: 'revenue', value: kpi.revenue }}>
        <RevenueCard />
      </Askable>
      <Askable meta={{ widget: 'churn', value: kpi.churn }}>
        <ChurnChart />
      </Askable>
      <button onClick={() => sendToAI(promptContext)}>Ask AI</button>
    </>
  );
}
```

### Restrict which events trigger focus

```tsx
// Click-only — no hover, no keyboard focus
const { promptContext } = useAskable({ events: ['click'] });

// Hover + focus, no click
const { promptContext } = useAskable({ events: ['hover', 'focus'] });
```

### Vue 3

```vue
<script setup>
import { Askable, useAskable } from '@askable-ui/vue';
const { promptContext } = useAskable();
</script>

<template>
  <Askable :meta="{ widget: 'revenue', value: kpi.revenue }">
    <RevenueCard :data="kpi" />
  </Askable>
</template>
```

### Svelte

```svelte
<script>
  import { Askable, createAskableStore } from '@askable-ui/svelte';
  const { promptContext, ctx } = createAskableStore();
  // call ctx.destroy() in onDestroy
</script>

<Askable meta={{ widget: 'revenue', value: kpi.revenue }}>
  <RevenueCard data={kpi} />
</Askable>
```

### SolidJS

```tsx
import { Askable, useAskable } from '@askable-ui/solid';

function Dashboard() {
  const { promptContext } = useAskable();

  return (
    <>
      <Askable meta={{ widget: 'revenue', value: kpi.revenue }}>
        <RevenueCard />
      </Askable>
      <button onClick={() => sendToAI(promptContext())}>Ask AI</button>
    </>
  );
}
```

Note: in SolidJS `promptContext` is a signal accessor — call it as `promptContext()` to read the current value.

### Angular

```ts
import { Component, inject } from '@angular/core';
import { AskableService } from '@askable-ui/angular';

@Component({
  template: `
    <div data-askable='{"widget":"revenue","value":"$2.3M"}'>
      <revenue-card />
    </div>
    <button (click)="askAI()">Ask AI</button>
  `,
})
export class DashboardComponent {
  private readonly askable = inject(AskableService);

  askAI() {
    const context = this.askable.promptContext();
    sendToLLM(context);
  }
}
```

Use `AskableDirective` for reactive annotations:

```ts
@Component({
  imports: [AskableDirective],
  template: `
    <div [askable]="{ widget: 'revenue', value: kpi.revenue }">
      <revenue-card />
    </div>
  `,
})
```

### Vanilla JS

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document.body);

ctx.on('focus', () => {
  console.log(ctx.toPromptContext());
});
```

---

## Explicit "Ask AI" button pattern

Use `ctx.select(element)` when the user signals intent with a button rather than passive hover/click. This pins focus to a specific element regardless of cursor position.

### React

```tsx
import { useRef } from 'react';
import { Askable, useAskable } from '@askable-ui/react';

function RevenueCard({ data }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { ctx, promptContext } = useAskable();

  function askAboutThis() {
    if (cardRef.current) ctx.select(cardRef.current);
    sendToAI(promptContext);
  }

  return (
    <Askable meta={{ widget: 'revenue', value: data.value, delta: data.delta }}>
      <div ref={cardRef}>
        <RevenueChart data={data} />
        <button onClick={askAboutThis}>Ask AI about this</button>
      </div>
    </Askable>
  );
}
```

`ctx.select()` fires the same `focus` event and updates history exactly like a user interaction — downstream code needs no special case.

---

## Programmatic context (virtual DOM / third-party libraries)

For AG Grid, TanStack Virtual, Recharts, or any library that renders its own DOM, use `ctx.push()` instead of `data-askable`:

```ts
// In a row click handler (AG Grid, TanStack Table, etc.)
onRowClicked(event) {
  ctx.push(
    { widget: 'deals-table', rowIndex: event.rowIndex, company: event.data.company, stage: event.data.stage },
    `${event.data.company} — ${event.data.stage} — ${event.data.value}`
  );
}

// In a chart hover handler (Recharts, ECharts, etc.)
onChartHover(payload) {
  ctx.push(
    { chart: 'revenue-trend', month: payload.month, value: payload.revenue },
    `Revenue ${payload.month}: ${payload.revenue}`
  );
}
```

`push()` has no DOM element. `focus.element` is `undefined` but everything else (serialization, history, events) works identically.

---

## Injecting context into LLM calls

### Single-turn

```ts
const result = await streamText({
  model: openai('gpt-4o'),
  system: `You are a helpful analytics assistant.\n\n${promptContext}`,
  messages,
});
```

### Multi-turn with history

```ts
// Current focus + last 5 interactions in one string
const context = ctx.toContext({ history: 5 });

const result = await streamText({
  model: openai('gpt-4o'),
  system: `You are a helpful analytics assistant.\n\n${context}`,
  messages,
});
```

### Anthropic SDK

```ts
const response = await client.messages.create({
  model: 'claude-opus-4-7',
  system: `You are a helpful analytics assistant.\n\n${ctx.toContext({ history: 3 })}`,
  messages: [{ role: 'user', content: userMessage }],
  max_tokens: 1024,
});
```

### Multi-region pages

Use named contexts to keep independent regions isolated:

```tsx
const { ctx: tableCtx, promptContext: tableContext } = useAskable({ name: 'table' });
const { ctx: chartCtx, promptContext: chartContext } = useAskable({ name: 'chart' });

// Send only what's relevant at each AI boundary
await streamText({ system: `Table context:\n${tableContext}`, ... });
await streamText({ system: `Chart context:\n${chartContext}`, ... });
```

---

## Sanitization and noise control

Always sanitize before context leaves the client. Sanitization hooks run at **capture time** — data never reaches serialization raw.

### Strip sensitive fields

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext({
  sanitizeMeta: ({ password, ssn, cardNumber, ...safe }) => safe,
});
```

### Mask text patterns

```ts
const ctx = createAskableContext({
  sanitizeText: (text) =>
    text
      .replace(/\d{16}/g, '[card]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]'),
});
```

### Accessibility-friendly text extraction

```ts
import { createAskableContext, a11yTextExtractor } from '@askable-ui/core';

// Prefers aria-label > aria-labelledby > title > alt > placeholder > textContent
const ctx = createAskableContext({ textExtractor: a11yTextExtractor });
```

### React hook with private sanitized context

```tsx
const { promptContext } = useAskable({
  sanitizeMeta: ({ internalId, ...safe }) => safe,
  sanitizeText: (t) => t.slice(0, 200),
  maxHistory: 10,
});
```

When you pass any context-creation option to `useAskable`, it creates a **private** context rather than joining the shared singleton.

---

## Viewport context

Enable viewport tracking to serialise all currently visible annotated elements — useful for "what am I looking at?" queries.

```tsx
const { ctx } = useAskable({ viewport: true });

// In the AI call
const visibleContext = ctx.toViewportContext();
```

---

## Development inspector

Add the inspector overlay during development to see live focus metadata and prompt output:

```tsx
import { AskableInspector, useAskable } from '@askable-ui/react';

// Option A: standalone component (matches shared context automatically)
{process.env.NODE_ENV === 'development' && <AskableInspector />}

// Option B: inline with hook (same context, same events)
const { promptContext } = useAskable({ inspector: true, events: ['click'] });
```

Do not ship `<AskableInspector>` or `{ inspector: true }` in production builds.

---

## App-owned context sources

Attach non-DOM data (tables, lists, API responses, documents) so the AI always has the right data — not just what's visible in the DOM.

### Registering a collection source

```ts
import { createAskableCollectionSource } from '@askable-ui/core';

const accountsSource = createAskableCollectionSource({
  describe: 'Accounts matching active filters',
  getState: () => ({ filter: activeFilter, sort: currentSort, page: currentPage }),
  getItems: () => allAccounts,           // all logical items (e.g. beyond current page)
  getVisibleItems: () => visibleRows,    // items rendered on screen
  getSummary: () => ({ total: allAccounts.length, filtered: visibleRows.length }),
  maxItems: 50,
  sanitizeItem: (account) => {
    const { internalId: _, rawSql: __, ...safe } = account;
    return safe;                         // strip PII / internal keys before sending
  },
});

ctx.registerSource('accounts', accountsSource);
```

`sanitizeItem` runs per item, async-safe. Rejected items are silently dropped so one bad row never crashes the whole source.

### Registering a generic source

```ts
import { createAskableSource } from '@askable-ui/core';

ctx.registerSource('current-doc', createAskableSource({
  kind: 'document',
  describe: 'Currently open editor document',
  state: () => ({ filename: editor.filename, isDirty: editor.isDirty }),
  data: ({ mode }) => mode === 'summary'
    ? { wordCount: editor.wordCount, language: editor.language }
    : { content: editor.getText() },
}));
```

### React: `useAskableSource`

```tsx
import { useAskableSource } from '@askable-ui/react';

function AccountsTable({ rows }) {
  const { handle } = useAskableSource('accounts', {
    getSummary: () => ({ total: rows.length }),
    getItems: () => rows,
    sanitizeItem: ({ internalId: _, ...safe }) => safe,
  });

  useEffect(() => {
    handle?.notifyChanged(); // tell context the data updated
  }, [rows, handle]);
}
```

### Vue 3: `useAskableSource`

```vue
<script setup>
import { useAskableSource } from '@askable-ui/vue';
import { computed } from 'vue';

const props = defineProps(['rows']);
useAskableSource('accounts', {
  getItems: () => props.rows,
  enabled: computed(() => props.rows.length > 0),
});
</script>
```

### SolidJS: `useAskableSource`

```tsx
import { useAskableSource } from '@askable-ui/solid';

function AccountsTable(props) {
  const { notifyChanged } = useAskableSource('accounts', {
    kind: 'collection',
    getState: () => ({ total: props.rows.length }),
    resolve: () => props.rows,
  });

  createEffect(() => {
    props.rows; // track the signal
    notifyChanged();
  });
}
```

### Svelte 5: `useAskableSource`

```svelte
<script lang="ts">
  import { useAskableSource } from '@askable-ui/svelte/useAskableSource.svelte';

  let { rows } = $props();
  const { notifyChanged } = useAskableSource('accounts', {
    kind: 'collection',
    resolve: () => rows,
  });

  $effect(() => {
    rows; // track reactivity
    notifyChanged();
  });
</script>
```

### Controlling source resolution

```ts
// Include specific sources in prompt output
const prompt = await ctx.toPromptContextAsync({
  sources: ['accounts', { id: 'current-doc', mode: 'summary', timeoutMs: 1500 }],
  sourceMode: 'summary',   // default mode for sources listed by string ID
  sourceErrorMode: 'omit', // 'include' (default), 'omit', or 'throw'
});
```

`sourceErrorMode`:
- `'include'` *(default)* — failed source appears with an error note; context is still emitted
- `'omit'` — failed source is silently dropped; healthy sources still appear
- `'throw'` — any failure rejects the whole promise

---

## Page context source

`useAskablePageSource` is a zero-config hook that automatically captures the current page title, URL, headings, selected text, and optional links as a named source called `"page"`. It requires no DOM annotations and works on any page — useful as a fallback for pages without `data-askable` attributes.

### React

```tsx
import { useAskablePageSource, useAskableAgent } from '@askable-ui/react';

function ChatButton() {
  useAskablePageSource({ includeLinks: false });
  const { send, isLoading } = useAskableAgent();

  return (
    <button disabled={isLoading} onClick={() =>
      send('What is on this page?', async (req) =>
        fetch('/api/chat', { method: 'POST', body: JSON.stringify(req) }).then(r => r.json())
      )
    }>
      {isLoading ? 'Thinking…' : 'Ask AI'}
    </button>
  );
}
```

### Vue 3

```vue
<script setup>
import { useAskablePageSource, useAskableAgent } from '@askable-ui/vue';

useAskablePageSource({ includeLinks: true });
const { send, status } = useAskableAgent();
</script>
```

### SolidJS

```tsx
import { useAskablePageSource, useAskableAgent } from '@askable-ui/solid';

function ChatButton() {
  useAskablePageSource({ includeLinks: false });
  const { send, isLoading } = useAskableAgent();

  return (
    <button disabled={isLoading()} onClick={() =>
      send('Summarise this page', async (req) =>
        fetch('/api/chat', { method: 'POST', body: JSON.stringify(req) }).then(r => r.json())
      )
    }>
      {isLoading() ? 'Thinking…' : 'Ask AI'}
    </button>
  );
}
```

### Svelte 5

```svelte
<script lang="ts">
  import { useAskablePageSource } from '@askable-ui/svelte/useAskablePageSource.svelte';

  const { toPromptContext } = useAskablePageSource({ includeLinks: true });
</script>
```

Options accepted by `useAskablePageSource`:

| Option | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `"page"` | Source registration id |
| `includeLinks` | `boolean` | `false` | Include links in resolved snapshot |
| `maxHeadings` | `number` | `20` | Maximum headings returned |
| `maxLinks` | `number` | `20` | Maximum links returned |
| `maxTextLength` | `number` | `8000` | Maximum body text chars (mode `"all"`) |
| `describe` | `string` | `"Current page"` | Human-readable description |
| `kind` | `string` | `"page"` | Source category label |
| `sanitizeText` | `function` | — | Redact or transform extracted text |
| `textExtractor` | `function` | — | Override how page text is read |

---

## Table context source — `useAskableTableSource`

`useAskableTableSource` wraps `createAskableCollectionSource` with a table-friendly API and auto-notifies on row data changes, so AI assistants can see all rows, the current page (visible), selections, and table state (sort / filter / search query).

Works with **any** table library: React Table / TanStack Table, AG Grid, plain arrays.

```tsx
// React — plain array or state
import { useAskableTableSource, useAskableAgent } from '@askable-ui/react';

function OrdersTable({ orders, selected, tableState }) {
  useAskableTableSource({
    id: 'orders',
    rows: orders,
    selectedRows: selected,
    state: tableState,           // { sort, filter, page }
    sanitizeRow: ({ id, date, amount, status }) => ({ id, date, amount, status }),
  });

  const { send } = useAskableAgent();
  // ...
}
```

```ts
// Vue — Ref<T[]> or plain arrays
import { useAskableTableSource } from '@askable-ui/vue';

const { notifyChanged } = useAskableTableSource({
  id: 'invoices',
  rows: allRowsRef,
  visibleRows: pageRowsRef,
  selectedRows: selectedRef,
  state: tableStateRef,
});
```

```tsx
// SolidJS — signal accessors
import { useAskableTableSource } from '@askable-ui/solid';

const [rows] = createSignal(allOrders);
const [selected, setSelected] = createSignal([]);

useAskableTableSource({
  id: 'orders',
  rows,
  selectedRows: selected,
  sanitizeRow: ({ id, amount }) => ({ id, amount }),
});
```

```svelte
<!-- Svelte 5 — $state getters -->
<script lang="ts">
  import { useAskableTableSource } from '@askable-ui/svelte/useAskableTableSource.svelte';

  let rows = $state(allOrders);
  let selected = $state([]);

  useAskableTableSource({
    rows: () => rows,
    selectedRows: () => selected,
  });
</script>
```

The default summary (mode `"summary"`) automatically computes `totalRows`, `visibleRows`, and `selectedRows`. Override with `getSummary` for custom aggregations.

Options accepted by `useAskableTableSource`:

| Option | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `"table"` | Source registration id |
| `rows` | `T[]` / accessor | — | All rows in the dataset |
| `visibleRows` | `T[]` / accessor | — | Rows currently on screen |
| `selectedRows` | `T[]` / accessor | — | User-selected rows |
| `state` | `S` / accessor | — | Table state (sort, filter, page) |
| `maxRows` | `number` | `100` | Max rows returned per resolution |
| `sanitizeRow` | `function` | — | Redact or transform each row |
| `getSummary` | `function` | auto | Override the summary object |
| `getRowId` | `function` | — | Stable row id for packet selection |
| `describe` | `string` | `"Data table"` | Human-readable description |
| `kind` | `string` | `"table"` | Source category label |

---

## Form context source — `useAskableFormSource`

`useAskableFormSource` registers a named source that reads HTML form state — field names, values, types, labels, and HTML5 validation errors — so an AI assistant can provide contextual help, suggest corrections, and guide users through multi-step forms.

Passwords are masked by default (`***`). Use `omitFields` to exclude sensitive fields. The hook listens to `input` and `change` events and calls `notifyChanged()` automatically (`autoTrack: true`).

```tsx
// React
import { useRef } from 'react';
import { useAskableAgent, useAskableFormSource } from '@askable-ui/react';

function CheckoutForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { toPromptContext } = useAskableFormSource({
    ref: formRef,
    omitFields: ['csrf_token'],
  });
  const { send, status } = useAskableAgent();

  async function handleHelp() {
    const result = await send('Help me complete this form correctly', async (req) => {
      // req.context includes field values + validation errors
      const res = await fetch('/api/form-help', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      return res.json();
    });
  }

  return (
    <form ref={formRef}>
      <input name="email" type="email" required />
      <input name="card" type="text" pattern="\d{16}" />
      <input name="cvv" type="password" />
      <button type="button" onClick={handleHelp} disabled={status === 'pending'}>
        {status === 'pending' ? 'Thinking…' : 'Get AI help'}
      </button>
    </form>
  );
}
```

```vue
<!-- Vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAskableFormSource, useAskableAgent } from '@askable-ui/vue';

const formRef = ref<HTMLFormElement>();
useAskableFormSource({ formRef, omitFields: ['_token'] });
const { send, status } = useAskableAgent();
</script>

<template>
  <form ref="formRef">
    <input name="email" type="email" required />
    <button type="button" :disabled="status === 'pending'" @click="handleHelp">
      {{ status === 'pending' ? 'Thinking…' : 'Get AI help' }}
    </button>
  </form>
</template>
```

```tsx
// SolidJS
import { useAskableFormSource, useAskableAgent } from '@askable-ui/solid';

function CheckoutForm() {
  let formEl!: HTMLFormElement;
  useAskableFormSource({ formRef: () => formEl, omitFields: ['csrf'] });
  const { send, status } = useAskableAgent();

  return <form ref={formEl}>{/* ... */}</form>;
}
```

```svelte
<!-- Svelte 5 -->
<script lang="ts">
  import { useAskableFormSource } from '@askable-ui/svelte/useAskableFormSource.svelte';
  import { useAskableAgent } from '@askable-ui/svelte/useAskableAgent.svelte';

  let formEl: HTMLFormElement | undefined = $state();
  const { toPromptContext } = useAskableFormSource({ formRef: () => formEl });
  const { send, status } = useAskableAgent();
</script>

<form bind:this={formEl}>{/* ... */}</form>
```

Options accepted by `useAskableFormSource`:

| Option | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `"form"` | Source registration id |
| `ref` / `formRef` | `Ref<HTMLFormElement>` | — | Ref or accessor returning the form element |
| `selector` | `string` | first `<form>` | CSS selector to locate the form |
| `autoTrack` | `boolean` | `true` | Re-notify on every `input`/`change` event |
| `omitFields` | `string[]` | `[]` | Field names to exclude from snapshots |
| `maskPasswords` | `boolean` | `true` | Replace password values with `"***"` |
| `describe` | `string` | `"Active form"` | Human-readable description |
| `kind` | `string` | `"form"` | Source category label |
| `resolveLabel` | `function` | — | Override how field labels are resolved |
| `resolveValue` | `function` | — | Override how field values are read |
| `sanitizeSnapshot` | `function` | — | Transform the entire snapshot before serialization |

The resolved snapshot (mode `"all"`) looks like:

```json
{
  "fields": [
    { "name": "email", "type": "email", "label": "Email address", "value": "user@example.com", "required": true },
    { "name": "cvv",   "type": "password", "label": "CVV", "value": "***" }
  ],
  "hasErrors": false,
  "errorCount": 0
}
```

---

## User profile source — `useAskableUserSource`

`useAskableUserSource` registers a named source that exposes the logged-in user's profile — name, role, plan, organization, locale — so AI assistants can personalise responses. Works with any auth library (Clerk, NextAuth, Supabase, Auth0, custom JWT).

```tsx
// React — NextAuth
import { useSession } from 'next-auth/react';
import { useAskableUserSource } from '@askable-ui/react';

function App() {
  const { data: session } = useSession();
  useAskableUserSource({
    user: session?.user ? {
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    } : null,
    omitFields: ['email'],  // omit from resolved context for privacy
  });
}
```

```tsx
// React — Clerk
import { useUser } from '@clerk/nextjs';
import { useAskableUserSource } from '@askable-ui/react';

function App() {
  const { user } = useUser();
  useAskableUserSource({
    user: user ? {
      name: user.fullName ?? undefined,
      role: user.publicMetadata.role as string,
      plan: user.publicMetadata.plan as string,
    } : null,
  });
}
```

```ts
// Vue — Pinia auth store
import { useAskableUserSource } from '@askable-ui/vue';

const auth = useAuthStore();
useAskableUserSource({
  user: computed(() => auth.user),  // Ref<AskableUserProfile | null>
  omitFields: ['email'],
});
```

```tsx
// SolidJS
import { useAskableUserSource } from '@askable-ui/solid';

const [user] = createSignal<AskableUserProfile | null>(null);
useAskableUserSource({ user, omitFields: ['email'] });
```

```svelte
<!-- Svelte 5 -->
<script lang="ts">
  import { useAskableUserSource } from '@askable-ui/svelte/useAskableUserSource.svelte';

  let user = $state<AskableUserProfile | null>(null);
  useAskableUserSource({ user: () => user });
</script>
```

Options accepted by `useAskableUserSource`:

| Option | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `"user"` | Source registration id |
| `user` | `AskableUserProfile \| null` / accessor | — | Current user (null = not logged in) |
| `omitFields` | `string[]` | `[]` | Fields to exclude for privacy (e.g. `["email"]`) |
| `sanitize` | `function` | — | Transform the profile before serialization |
| `describe` | `string` | `"Logged-in user"` | Human-readable description |
| `kind` | `string` | `"user"` | Source category label |

The `AskableUserProfile` type accepts `name`, `email`, `role`, `plan`, `organization`, `locale`, and any custom `[key: string]: unknown` fields.

---

## Error context source — `useAskableErrorSource`

`useAskableErrorSource` registers a named source that exposes validation errors, API failures, and caught exceptions so an AI assistant can diagnose problems and guide the user to resolution.

```tsx
// React — React Hook Form compatible
import { useForm } from 'react-hook-form';
import { useAskableErrorSource } from '@askable-ui/react';

function CheckoutForm() {
  const { register, formState: { errors } } = useForm();
  useAskableErrorSource({ errors });  // errors is Record<string, { message: string }>

  return <form>...</form>;
}
```

```tsx
// React — manual errors
const [apiError, setApiError] = useState<Error | null>(null);
useAskableErrorSource({ errors: apiError });

// Or mixed
useAskableErrorSource({
  errors: {
    email: 'Invalid email address',
    card: ['Card number is required', 'Must be 16 digits'],
  }
});
```

```ts
// Vue — VeeValidate / reactive errors
import { useAskableErrorSource } from '@askable-ui/vue';

const errors = ref<Record<string, string>>({});
useAskableErrorSource({ errors });
```

```svelte
<!-- Svelte 5 -->
<script lang="ts">
  import { useAskableErrorSource } from '@askable-ui/svelte/useAskableErrorSource.svelte';

  let errors = $state<Record<string, string>>({});
  useAskableErrorSource({ errors: () => errors });
</script>
```

The resolved snapshot separates errors from warnings:

```json
{
  "errors":   [{ "key": "email", "message": "Invalid email address", "severity": "error" }],
  "warnings": [{ "key": "card", "message": "Card expires soon", "severity": "warning" }],
  "hasErrors": true,
  "hasWarnings": true,
  "total": 2
}
```

---

## Agent requests — `useAskableAgent`

`useAskableAgent` bundles the current context into a typed request object, calls your async handler, and tracks loading/success/error state. It's the recommended way to wire the "Ask AI" button in any framework.

### React

```tsx
import { useAskableAgent } from '@askable-ui/react';

function AskButton() {
  const { send, isLoading, data, error } = useAskableAgent({
    onSuccess: (response) => console.log('AI said:', response),
    onError: (err) => console.error(err),
  });

  return (
    <button disabled={isLoading} onClick={() =>
      send('What am I looking at?', async (req) => {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        });
        return res.json();
      })
    }>
      Ask AI
    </button>
  );
}
```

`req` is an `AskableAgentRequest`:
```ts
{
  requestId: string;
  question: string;        // the string you passed to send()
  context: string;         // full prompt-ready context string
  focus: AskableFocus | null;
  packet?: WebContextPacket;
  metadata?: Record<string, unknown>;
  timestamp: number;
}
```

### Vue 3

```vue
<script setup lang="ts">
import { useAskableAgent } from '@askable-ui/vue';

const { send, status, data, error } = useAskableAgent();

async function askAI() {
  await send('Explain what I see', async (req) =>
    fetch('/api/ai', { method: 'POST', body: JSON.stringify(req) }).then(r => r.json())
  );
}
</script>
```

### SolidJS

```tsx
import { useAskableAgent } from '@askable-ui/solid';

function AskButton() {
  const { send, isLoading, status } = useAskableAgent();

  return (
    <button disabled={isLoading()} onClick={() =>
      send('What is this?', async (req) =>
        fetch('/api/ai', { method: 'POST', body: JSON.stringify(req) }).then(r => r.json())
      )
    }>
      {status() === 'pending' ? 'Thinking…' : 'Ask AI'}
    </button>
  );
}
```

### Svelte 5

```svelte
<script lang="ts">
  import { useAskableAgent } from '@askable-ui/svelte/useAskableAgent.svelte';

  const { send, isLoading, data, error } = useAskableAgent();
</script>

<button disabled={isLoading} onclick={() =>
  send('What is on screen?', async (req) =>
    fetch('/api/ai', { method: 'POST', body: JSON.stringify(req) }).then(r => r.json())
  )
}>
  {isLoading ? 'Thinking…' : 'Ask AI'}
</button>
```

### With `onRequest` middleware

Use `onRequest` to modify the request before it reaches your handler — useful for injecting metadata, custom headers, or additional context sources:

```ts
const { send } = useAskableAgent({
  onRequest: (req) => ({
    ...req,
    metadata: { ...req.metadata, userId: currentUser.id, route: router.pathname },
  }),
});
```

### Request options

Pass `requestOptions` to include async sources or attach a full `WebContextPacket`:

```ts
const { send } = useAskableAgent({
  requestOptions: {
    sources: ['accounts'],
    sourceMode: 'summary',
    packet: true,
  },
});
```

---

## Streaming LLM responses — `useAskableStream`

`useAskableStream` handles a single streaming response. It accumulates text chunks into a reactive `content` string and exposes `abort()` to cancel mid-stream. Use it when you want a fire-and-forget streaming button, not a full conversation.

### React

```tsx
import { useAskableStream } from '@askable-ui/react';

function AskButton() {
  const { stream, content, isStreaming, reset } = useAskableStream({
    onSuccess: (text) => console.log('Finished:', text.length, 'chars'),
  });

  return (
    <>
      {content && <p>{content}</p>}
      <button disabled={isStreaming} onClick={() =>
        stream('Summarize what I see', async (req, emit) => {
          const res = await fetch('/api/stream', {
            method: 'POST',
            body: JSON.stringify(req),
          });
          const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            emit(value);
          }
        })
      }>
        {isStreaming ? 'Streaming…' : 'Ask AI'}
      </button>
      {content && <button onClick={reset}>Clear</button>}
    </>
  );
}
```

Use `streamFrom()` to pipe a `ReadableStream<string>` or `AsyncIterable<string>` directly:

```ts
// Vercel AI SDK textStream
const { output } = streamText({ model, system, messages });
await streamFrom('Summarize this', output.textStream);

// AsyncIterable (Anthropic SDK, LangChain, etc.)
await streamFrom('Summarize this', anthropicStream);
```

Available in React, Vue 3, SolidJS, Svelte 5, and React Native.

---

## Multi-turn chat — `useAskableChat`

`useAskableChat` manages a full conversation thread with automatic context injection on every turn. Each call to `append()` bundles the current UI focus, history, and sources into the request — the AI always knows what the user is looking at, across the entire conversation.

### React

```tsx
import { useAskableChat } from '@askable-ui/react';

function ChatPanel() {
  const { messages, append, isStreaming, clearMessages } = useAskableChat({
    systemPrompt: (ctx) => `You are a helpful analytics assistant.\n\n${ctx}`,
  });

  async function handleSubmit(text: string) {
    await append(text, async (req, msgs, emit) => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: msgs.map(m => ({ role: m.role, content: m.content })),
          system: req.context,
        }),
      });
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        emit(value);
      }
    });
  }

  return (
    <div>
      {messages.map(m => (
        <div key={m.id} className={`message ${m.role}`}>{m.content}</div>
      ))}
      <ChatInput onSubmit={handleSubmit} disabled={isStreaming} />
      <button onClick={clearMessages}>Clear</button>
    </div>
  );
}
```

The handler receives three arguments:
- `request: AskableAgentRequest` — the current context bundle
- `messages: AskableChatMessage[]` — all previous messages in the thread (excluding the new assistant placeholder)
- `emit: (chunk: string) => void` — call this for each text chunk

### Vue 3

```vue
<script setup lang="ts">
import { useAskableChat } from '@askable-ui/vue';

const { messages, append, isStreaming } = useAskableChat({
  systemPrompt: (ctx) => `You are helpful.\n\n${ctx}`,
});
</script>

<template>
  <div v-for="msg in messages" :key="msg.id" :class="msg.role">
    {{ msg.content }}
  </div>
  <button @click="append(input, handler)" :disabled="isStreaming.value">Send</button>
</template>
```

### SolidJS

```tsx
import { For } from 'solid-js';
import { useAskableChat } from '@askable-ui/solid';

function Chat() {
  const { messages, append, isStreaming } = useAskableChat({
    systemPrompt: (ctx) => `You are helpful.\n\n${ctx}`,
  });

  return (
    <div>
      <For each={messages()}>{(msg) =>
        <div class={msg.role}>{msg.content}</div>
      }</For>
      <button disabled={isStreaming()} onClick={() => append(userInput, handler)}>
        Send
      </button>
    </div>
  );
}
```

### Svelte 5

```svelte
<script lang="ts">
  import { useAskableChat } from '@askable-ui/svelte/useAskableChat.svelte';

  const chat = useAskableChat({
    systemPrompt: (ctx) => `You are helpful.\n\n${ctx}`,
  });
</script>

{#each chat.messages as msg (msg.id)}
  <div class={msg.role}>{msg.content}</div>
{/each}
<button disabled={chat.isStreaming} onclick={() => chat.append(input, handler)}>Send</button>
```

---

## Streaming context with `subscribeAsync`

Use `subscribeAsync` for live multi-turn agent transports — every time focus changes, the subscriber fires with fresh context including async source data.

```ts
const unsubscribe = ctx.subscribeAsync(async (context, focus) => {
  // context is the fully resolved prompt string (sources included)
  await myStreamingLLM.updateSystemPrompt(context);
}, {
  sources: 'all',
  sourceMode: 'summary',
  sourceErrorMode: 'omit',
  debounce: 300,        // ms to wait after the last focus change before firing
  emitInitial: true,    // fire immediately on subscribe (before the first user interaction)
});

// Stop listening
unsubscribe();
```

For one-shot async serialization without subscribing:

```ts
const prompt = await ctx.toPromptContextAsync({
  sources: ['accounts'],
  history: 3,
  sourceMode: 'summary',
});
```

---

## Packaging context for agent requests

`toAgentRequest` bundles the current context, focus, and an optional `WebContextPacket` into a single typed object — ready to send over HTTP, WebSocket, or any agent transport.

```ts
const request = await ctx.toAgentRequest('Which accounts need follow-up?', {
  requestId: crypto.randomUUID(),
  sources: ['accounts'],
  excludeKeys: ['internalId'],   // strip keys before they reach the packet
  packet: true,                  // include a full WebContextPacket
  metadata: { route: '/accounts', userId: session.userId },
});

// request.context  — prompt-ready string
// request.focus    — serialized focus (null if nothing focused)
// request.packet   — full WebContextPacket (undefined if packet:false)
// request.metadata — your app-level metadata passed through verbatim
// request.timestamp — Unix ms epoch

await fetch('/api/agent', {
  method: 'POST',
  body: JSON.stringify(request),
});
```

Pass an existing `WebContextPacket` (from a region capture, etc.) instead of `packet: true`:

```ts
const request = await ctx.toAgentRequest('Explain this selection', {
  packet: capturedPacket,
});
```

---

## Server-side request validation

Use `isAskableAgentRequest` to validate incoming requests in your API route before trusting them:

```ts
import { isAskableAgentRequest } from '@askable-ui/core';

// Next.js App Router
export async function POST(req: Request) {
  const body = await req.json();

  if (!isAskableAgentRequest(body)) {
    return new Response('Invalid request', { status: 400 });
  }

  // body.question, body.context, body.focus, body.timestamp are all validated
  const result = await streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: body.context,
    messages: [{ role: 'user', content: body.question }],
  });

  return result.toTextStreamResponse();
}
```

`isAskableAgentRequest` checks:
- `question` is a non-empty string
- `context` is a string
- `focus` is `null` or an object
- `timestamp` is a finite number
- `packet` (if present) is a valid `WebContextPacket`

It does **not** validate `metadata` (passed verbatim) or enforce authentication — add those yourself.

---

## MCP integration (`@askable-ui/mcp`)

Connect Askable context to any MCP-compatible LLM client (Claude Desktop, Cursor, custom agents) using `@askable-ui/mcp`.

```bash
npm install @askable-ui/mcp
```

### Wiring the MCP server

```ts
import { createAskableMcpServer, createAskableMcpContextProvider } from '@askable-ui/mcp';
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document.body);

// Optional: register sources
ctx.registerSource('accounts', accountsSource);

const provider = createAskableMcpContextProvider(ctx, {
  source: { app: 'my-dashboard', version: '1.0.0' },
  sources: 'all',
  sourceMode: 'summary',
  privacy: { consent: 'explicit' },
});

const server = createAskableMcpServer({ provider });
// Attach server to your MCP transport (SSE, stdio, etc.)
```

The server exposes three tools to connected agents:
- `get_current_context` — returns the current `WebContextPacket` as JSON
- `format_context_for_prompt` — returns a prompt-ready text rendering of the context
- `get_context_schema` — returns the JSON Schema for `WebContextPacket`

### When to use MCP vs direct API

| Use case | Approach |
|---|---|
| React/Vue app with in-page AI sidebar | Direct API — `useAskable` + `toAgentRequest` |
| Claude Desktop / Cursor plugin | MCP server |
| Custom agent outside the browser | MCP server or `toAgentRequest` over HTTP |
| Streaming context to a live agent transport | `subscribeAsync` |

---

## Common mistakes

**Over-annotating.** Only annotate elements whose data is directly useful to an AI answer. Annotating generic layout wrappers (`<header>`, `<nav>`, `<main>`) adds noise without value.

**Passing raw internal state.** `meta` becomes prompt text. Strip internal IDs, database primary keys, and implementation details before they reach `data-askable`. Use `sanitizeMeta` or curate `meta` at the component level.

**Noisy text extraction.** Large `textContent` blocks (tables, long lists) degrade prompt quality. Use `data-askable-text` to provide a concise label, `sanitizeText` to truncate, or `maxTextLength` in serialization options.

**Inspector context mismatch.** In React, `<AskableInspector />` without options creates its own default context. If your hook uses custom `events`, pass the same config to the inspector or use `useAskable({ inspector: true, events: [...] })` so they share one context.

```tsx
// Wrong — inspector runs on default context, hook runs on click-only context
useAskable({ events: ['click'] });
<AskableInspector />

// Correct — same context
useAskable({ inspector: true, events: ['click'] });
```

**Forgetting Svelte cleanup.** `createAskableStore` returns a `destroy` function. Call it in `onDestroy` or the observer leaks.

```svelte
<script>
  import { onDestroy } from 'svelte';
  import { createAskableStore } from '@askable-ui/svelte';
  const { promptContext, destroy } = createAskableStore();
  onDestroy(destroy);
</script>
```

**Calling `useAskable` multiple times with incompatible options.** In React/Vue, two calls with the same `events` config share one observer. Two calls with different options create separate private contexts. Be explicit with `name` when you need isolated regions.

**Serializing before a focus event fires.** `promptContext` is an empty string until the user interacts or `ctx.push()` / `ctx.select()` is called. Guard your LLM call or provide a fallback:

```ts
if (!promptContext) return; // or use a default system prompt
```

---

## Keyboard shortcut — useAskableKeyboardShortcut

`useAskableKeyboardShortcut` adds Cmd+K / Ctrl+K (or any shortcut) to your app. When pressed, it composes the full AI context from all registered sources and calls `onTrigger` with the resulting string — ready to inject into any LLM chat.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `shortcut` | `string` | `"mod+k"` | Shortcut string. `mod` = Cmd on Mac, Ctrl elsewhere |
| `onTrigger` | `(context, event) => void` | — | Called with composed context when shortcut fires |
| `toggle` | `boolean` | `false` | Auto-toggle `isOpen` on each trigger |
| `enabled` | `boolean` | `true` | Whether the listener is active |
| `preventDefault` | `boolean` | `true` | Prevent default browser action |
| `sources` | `AskableContextSourceInclude[]` | all | Sources to include in composed context |

### React

```tsx
import { useAskableKeyboardShortcut } from '@askable-ui/react';

// Toggle an AI chat panel with Cmd+K
const { isOpen, setOpen, lastContext } = useAskableKeyboardShortcut({
  toggle: true,
  onTrigger: (context) => console.log('AI context ready:', context.length, 'chars'),
});

return isOpen ? <AIChatPanel context={lastContext} onClose={() => setOpen(false)} /> : null;
```

### Vue

```ts
import { useAskableKeyboardShortcut } from '@askable-ui/vue';

const { isOpen, setOpen, lastContext } = useAskableKeyboardShortcut({
  shortcut: 'mod+k',
  toggle: true,
  onTrigger: (context) => chat.setSystemContext(context),
});
```

### SolidJS

```tsx
import { useAskableKeyboardShortcut } from '@askable-ui/solid';

const { isOpen, setOpen, lastContext } = useAskableKeyboardShortcut({
  toggle: true,
  onTrigger: (context) => setSystemPrompt(context),
});
```

### Svelte 5

```svelte
<script lang="ts">
  import { useAskableKeyboardShortcut } from '@askable-ui/svelte/useAskableKeyboardShortcut.svelte';

  const kc = useAskableKeyboardShortcut({ toggle: true });
</script>

{#if kc.isOpen}
  <AIChatPanel context={kc.lastContext} onClose={() => kc.setOpen(false)} />
{/if}
```

---

## Navigation context source — useAskableNavigationSource

`useAskableNavigationSource` tracks the current route, page title, route parameters, query string, and navigation history. Works with any router — pass a `getPath` getter that reads from your router's reactive state.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `getPath` | `() => string` | `window.location.*` | Current path getter |
| `getTitle` | `() => string \| null` | `document.title` | Current title getter |
| `getParams` | `() => Record<string, string>` | — | Route parameters getter |
| `maxHistory` | `number` | `10` | Maximum history entries |
| `pathname` | `string \| Ref<string>` (framework-specific) | — | Reactive path; triggers auto-notify |

### React (React Router v6)

```tsx
import { useLocation, useParams } from 'react-router-dom';
import { useAskableNavigationSource } from '@askable-ui/react';

const location = useLocation();
const params = useParams();
useAskableNavigationSource({
  pathname: location.pathname,
  getPath: () => location.pathname + location.search,
  getParams: () => params as Record<string, string>,
});
```

### Next.js App Router

```tsx
import { usePathname, useSearchParams } from 'next/navigation';
import { useAskableNavigationSource } from '@askable-ui/react';

const pathname = usePathname();
const searchParams = useSearchParams();
useAskableNavigationSource({
  pathname,
  getPath: () => pathname + (searchParams.toString() ? '?' + searchParams.toString() : ''),
});
```

### Vue Router

```ts
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import { useAskableNavigationSource } from '@askable-ui/vue';

const route = useRoute();
useAskableNavigationSource({
  pathname: computed(() => route.fullPath),
  getPath: () => route.fullPath,
  getParams: () => route.params as Record<string, string>,
});
```

### SvelteKit

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { useAskableNavigationSource } from '@askable-ui/svelte/useAskableNavigationSource.svelte';

  useAskableNavigationSource({
    pathname: () => $page.url.pathname,
    getPath: () => $page.url.pathname + $page.url.search,
  });
</script>
```

### Resolved snapshot

```json
{
  "currentPath": "/users/42?tab=activity",
  "currentTitle": "User Profile",
  "params": { "userId": "42" },
  "query": { "tab": "activity" },
  "history": [
    { "path": "/users/42?tab=activity", "title": "User Profile", "timestamp": "2024-01-15T10:30:00.000Z" },
    { "path": "/dashboard", "title": "Dashboard", "timestamp": "2024-01-15T10:28:00.000Z" }
  ]
}
```

---

## DOM element source — useAskableDOMSource

`useAskableDOMSource` captures any DOM element's text content, ARIA labels, roles, data attributes, and selected attributes as AI context. Ideal for rich text editors, custom widgets, canvases, or any element without a dedicated source.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ref` / `elementRef` | `RefObject<Element>` | — | Framework ref to the target element |
| `selector` | `string` | — | CSS selector to find element |
| `includeAttributes` | `string[]` | `[]` | Specific attribute names to capture |
| `maxTextLength` | `number` | `2000` | Truncate text content at this length |
| `observeChanges` | `boolean` | `false` | Auto-notify via MutationObserver |
| `kind` | `string` | `"dom"` | Custom source category |

### React

```tsx
import { useRef } from 'react';
import { useAskableDOMSource } from '@askable-ui/react';

const editorRef = useRef<HTMLDivElement>(null);
useAskableDOMSource({
  ref: editorRef,
  id: 'editor',
  includeAttributes: ['contenteditable', 'data-format'],
  maxTextLength: 8000,
  observeChanges: true,  // auto-notify on content changes
});

return <div ref={editorRef} contenteditable>Type here…</div>;
```

### Vue

```vue
<script setup>
import { useTemplateRef } from 'vue';
import { useAskableDOMSource } from '@askable-ui/vue';

const editorEl = useTemplateRef('editor');
useAskableDOMSource({
  elementRef: editorEl,
  id: 'editor',
  observeChanges: true,
});
</script>
<template>
  <div ref="editor" contenteditable>Type here…</div>
</template>
```

### Resolved snapshot

```json
{
  "tag": "div",
  "text": "The quick brown fox jumps over the lazy dog",
  "label": "Rich text editor",
  "role": "textbox",
  "id": "editor",
  "classes": ["editor", "prose"],
  "data": { "format": "markdown" },
  "attributes": { "contenteditable": "true" },
  "childCount": 3
}
```

---

## Customising this file for your project

Before committing this file to your own repo, update the sections that are product-specific:

- Replace generic examples (`revenue`, `churn`) with your actual widget names and data shapes.
- Document which `events` your app uses and why.
- Document which fields are sanitized and the business reason.
- Add your app's LLM integration pattern (which SDK, which model, where context is injected).
- Remove framework sections that don't apply to your stack.

---

## Further reading

- [Getting started](https://askable-ui.com/docs/guide/getting-started)
- [Annotating elements](https://askable-ui.com/docs/guide/annotating)
- [React guide](https://askable-ui.com/docs/guide/react)
- [Vue guide](https://askable-ui.com/docs/guide/vue)
- [Svelte guide](https://askable-ui.com/docs/guide/svelte)
- [SolidJS guide](https://askable-ui.com/docs/guide/solid)
- [Angular guide](https://askable-ui.com/docs/guide/angular)
- [Qwik guide](https://askable-ui.com/docs/guide/qwik)
- [MCP server guide](https://askable-ui.com/docs/api/mcp)
- [API reference](https://askable-ui.com/docs/api/core)
