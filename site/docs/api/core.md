# @askable-ui/core

Framework-agnostic context tracker. Zero dependencies and built to stay lightweight.

## Install

```bash
npm install @askable-ui/core
```

## `createAskableContext(options?)`

Factory function. Returns a new `AskableContext` instance.

```ts
import { createAskableContext } from '@askable-ui/core';

// Default — uses textContent for text extraction, no sanitization
const ctx = createAskableContext();

// Custom text extractor — prefer ARIA labels
const ctx = createAskableContext({
  textExtractor: (el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
});

// Sanitize sensitive fields before capture
const ctx = createAskableContext({
  sanitizeMeta: ({ password, ssn, ...safe }) => safe,
  sanitizeText: (text) => text.replace(/\b\d{16}\b/g, '[card]'),
});

// Track all annotated elements currently visible in the viewport
const viewportCtx = createAskableContext({ viewport: true });
```

**Options (`AskableContextOptions`):**

| Option | Type | Description |
|---|---|---|
| `viewport` | `boolean` | Enable viewport tracking via `IntersectionObserver`. Default: `false`. |
| `textExtractor` | `(el: HTMLElement) => string` | Custom text extractor. Defaults to `el.textContent?.trim()`. Applied at capture time. |
| `sanitizeMeta` | `(meta: Record<string, unknown>) => Record<string, unknown>` | Redact/transform object meta before storing. Not called for string meta. Applied at capture time. |
| `sanitizeText` | `(text: string) => string` | Redact/transform text content before storing. Applied at capture time. |

---

## HTML attributes

| Attribute | Value | Description |
|---|---|---|
| `data-askable` | JSON object or string | Marks an element as askable. Value becomes `AskableFocus.meta`. |
| `data-askable-scope` | string | Optional category filter. Scoped queries like `ctx.toPromptContext({ scope: 'analytics' })` include matching scoped entries plus unscoped ones. |
| `data-askable-parent` | CSS selector | Explicit parent annotation to use in hierarchy paths when DOM nesting alone is not enough. |
| `data-askable-priority` | integer | Override the default innermost-wins rule in `'deepest'` strategy. Higher values win. |
| `data-askable-text` | string | Override the text captured from this element. Empty string `""` suppresses text entirely. Takes priority over `textExtractor`. |

---

## `AskableContext`

### `observe(root, options?)`

Start observing a DOM subtree for `[data-askable]` elements. Attaches event listeners to all matching elements and uses a `MutationObserver` to track dynamically added/removed elements as well as attribute updates to `data-askable`, `data-askable-text`, and `data-askable-priority`.

Safe to call outside the browser — it is a no-op if `window`, `document`, or `MutationObserver` are unavailable.

```ts
// Observe the entire document (all events)
ctx.observe(document);

// Specific element
ctx.observe(document.getElementById('dashboard')!);

// Restrict events
ctx.observe(document, { events: ['click'] });
ctx.observe(document, { events: ['click', 'focus'] });

// Debounce hover — wait until pointer settles
ctx.observe(document, { hoverDebounce: 75 });

// On touch/coarse-pointer devices, hover-only configs resolve from tap by default
ctx.observe(document, { events: ['hover'] });

// Throttle hover — at most one update per window
ctx.observe(document, { hoverThrottle: 100 });
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `root` | `HTMLElement \| Document` | Root element to observe |
| `options.events` | `AskableEvent[]` | Trigger events. Default: `['click', 'hover', 'focus']`. On touch/coarse-pointer devices, `hover` resolves from tap by default. |
| `options.targetStrategy` | `AskableTargetStrategy` | Which element wins when nested `[data-askable]` elements are involved. Default: `'deepest'` |
| `options.hoverDebounce` | `number` | Debounce delay in ms for hover interactions. Default: `0` |
| `options.hoverThrottle` | `number` | Throttle window in ms for hover interactions. Default: `0` |

**`AskableTargetStrategy` values:**

| Value | Behaviour |
|---|---|
| `'deepest'` | Innermost `[data-askable]` element wins. Override with `data-askable-priority`. |
| `'shallowest'` | Outermost `[data-askable]` ancestor wins; inner elements are suppressed. |
| `'exact'` | Only fires when the event target itself has `[data-askable]`. No bubbled triggers. |

---

### `unobserve()`

Stop observing and detach all listeners. Does not destroy the context — you can call `observe()` again afterward.

```ts
ctx.unobserve();
```

---

### `getFocus()`

Returns the current `AskableFocus`, or `null` if no element has been interacted with.

```ts
const focus = ctx.getFocus();
if (focus) {
  console.log(focus.source);    // 'dom' | 'select' | 'push'
  console.log(focus.meta);      // Record<string, unknown> | string
  console.log(focus.ancestors); // optional ancestor chain, outermost first
  console.log(focus.text);      // trimmed textContent
  console.log(focus.element);   // HTMLElement | undefined (undefined for push())
  console.log(focus.timestamp); // Unix ms
}
```

---

### `getHistory(limit?)`

Returns focus history, newest first. Capped at 50 entries internally.

```ts
ctx.getHistory();      // all entries
ctx.getHistory(5);     // last 5
```

**Returns:** `AskableFocus[]`

---

### `on(event, handler)` / `off(event, handler)`

Subscribe/unsubscribe to events.

```ts
const handler = (focus: AskableFocus) => {
  console.log('Focused:', focus.meta);
};

ctx.on('focus', handler);
ctx.off('focus', handler);

// 'clear' event fires when ctx.clear() is called
ctx.on('clear', () => console.log('Focus cleared'));
```

**Events:**

| Event | Payload | Fires when |
|---|---|---|
| `'focus'` | `AskableFocus` | A `[data-askable]` element is clicked, hovered, focused, `select()` is called, or `push()` is called |
| `'clear'` | `null` | `ctx.clear()` is called |

---

### `select(element)`

Programmatically set focus to any `HTMLElement`. Fires the `'focus'` event and updates history. Use for "Ask AI" button patterns.

```ts
const el = document.querySelector('[data-askable]') as HTMLElement;
ctx.select(el);
```

---

### `push(meta, text?, options?)`

Set focus from data alone — no DOM element required. Fires the `'focus'` event and updates history. The resulting `AskableFocus` has `source: 'push'` and `element: undefined`.

This is the idiomatic solution for libraries that manage their own DOM (AG Grid, TanStack Table, chart libraries, etc.) where you cannot add `data-askable` attributes to internal elements.

```ts
// Object meta
ctx.push({ widget: 'deals-table', rowIndex: 3, company: 'Acme' }, 'Acme Corp — Closed Won');

// String meta
ctx.push('row-label');

// No text
ctx.push({ chart: 'revenue', period: 'Q3' });

// Explicit hierarchy for non-DOM or synthetic UIs
ctx.push(
  { metric: 'revenue', value: '$2.3M' },
  'Revenue card',
  {
    ancestors: [
      { meta: { view: 'dashboard' }, text: 'Dashboard' },
      { meta: { tab: 'finance' }, text: 'Finance' },
    ],
  },
);
```

Sanitizers (`sanitizeMeta`, `sanitizeText`) apply to `push()` the same way they apply to DOM-sourced focus.

---

### `registerSource(id, source)`

Register app-owned context that is not fully represented in the DOM: paginated
tables, virtualized lists, documents, maps, canvases, calendars, charts, file
trees, or any custom state.

```ts
import {
  createAskableCollectionSource,
  createAskablePageSource,
  createAskableSource,
} from '@askable-ui/core';

const handle = ctx.registerSource('accounts', createAskableCollectionSource({
  describe: 'Customer accounts in the dashboard',
  getState: () => ({
    filters,
    sort,
    page,
    pageSize,
    totalCount,
  }),
  getVisibleItems: () => table.getVisibleRows(),
  getSelectedItems: ({ selection }) => getSelectedAccounts(selection),
  getItems: () => accountStore.getAllMatching({ filters, sort }),
  getSummary: ({ focus, maxItems }) => summarizeAccounts({ filters, sort, focus, maxItems }),
  maxItems: 50,
  sanitizeItem: redactAccountFields,
  sanitize: (source) => ({
    ...source,
    state: redactFilterState(source.state),
  }),
}));

ctx.registerSource('active-document', createAskableSource({
  kind: 'document',
  describe: 'Open editor document',
  state: () => ({ title: editor.title, dirty: editor.dirty }),
  modes: {
    summary: () => editor.summary(),
    selected: ({ selection }) => editor.sliceForSelection(selection),
    all: ({ maxTokens }) => editor.export({ maxTokens }),
  },
  data: ({ mode }) => editor.export({ mode }),
}));

ctx.registerSource('page', createAskablePageSource({
  includeLinks: true,
  maxTextLength: 6000,
  sanitizeText: redactPageText,
}));

await ctx.toPromptContextAsync({
  sources: [{ id: 'accounts', mode: 'all', maxItems: 20, timeoutMs: 750 }],
  sourceErrorMode: 'include',
});

table.onStateChange(() => {
  handle.notifyChanged();
});

handle.unregister();
```

Use this when the UI only renders part of the data. Askable captures what the
user meant; the source resolver supplies what the app knows.

| Field | Type | Description |
|---|---|---|
| `kind` | `string` | Optional category, such as `collection`, `document`, `chart`, `map`, or `custom` |
| `modes` | `readonly AskableContextSourceMode[]` | Advertised modes for source pickers, inspectors, chat controls, and MCP bridges |
| `describe` | `string \| () => string \| Promise<string>` | Human-readable source description |
| `getState` | `() => unknown \| Promise<unknown>` | Current state, such as filters, sort, page, route, or viewport |
| `modes` | `Record<string, value \| resolver>` | Named slices for `summary`, `selected`, `all`, or app-defined source modes |
| `data` | `unknown \| (request) => unknown \| Promise<unknown>` | Fallback data when the requested mode is not listed in `modes` |
| `resolve` | `(request) => unknown \| Promise<unknown>` | Returns selected, visible, summary, all-matching, or custom context |
| `sanitize` | `(source) => source \| Promise<source>` | Redacts or transforms resolved source context before serialization |

`createAskableSource()` is a small factory for arbitrary app context.
Use its `modes` map when the source can expose named slices without a custom
switch statement; `resolve` remains available for advanced behavior and
overrides both `modes` and `data`.
`createAskableCollectionSource()` adds `getItems`, `getVisibleItems`,
`getSelectedItems`, `getSummary`, `maxItems`, and `sanitizeItem` so paginated or
virtualized collections can expose more than the rows currently mounted in the
DOM without a table-specific API.
`createAskablePageSource()` snapshots unannotated pages for extension and
fallback contexts. It supports `summary`, `selected`, and `all` modes for page
title, URL, selected text, headings, optional links, and capped full-page text.

`registerSource()` returns a handle with `id`, `notifyChanged()`, and
`unregister()`. Call `notifyChanged()` when filters, pagination, selected
records, query caches, documents, or store data change without a DOM focus
change. Source-backed async subscribers re-resolve matching sources
automatically. Stale handles from unmounted or replaced components cannot
unregister or notify a newer source with the same id.

Use `ctx.hasSource(id)` and `ctx.listSources()` to drive source pickers,
diagnostics, or chat controls without resolving source data. `listSources()`
returns each source id, optional kind, advertised modes, registration time, and
last update time. Helper factories infer modes from configured resolvers:
collection sources can advertise `summary`, `visible`, `selected`, and `all`;
generic sources advertise keys from their `modes` map. Pass
`advertisedModes` to expose custom slices such as `next-actions` or `export`.

Use `ctx.resolveSources()` when an agent bridge, chat endpoint, or debug surface
needs source data as structured objects instead of prompt text. It resolves all
registered sources by default, or the requested subset when `sources` is passed.

Async prompt methods isolate source failures by default. If a resolver throws or
times out, Askable includes a safe `Context source unavailable.` marker and does
not expose the original error message or stack trace. Use
`sourceErrorMode: 'omit'` to skip failed sources or `'throw'` to fail the prompt
call.

Related methods:

```ts
ctx.hasSource('accounts');
ctx.listSources();
ctx.unregisterSource('accounts');
ctx.notifySourceChanged('accounts');
await ctx.resolveSource('accounts', { mode: 'visible' });
await ctx.resolveSources({ sources: [{ id: 'accounts', mode: 'all' }] });
await ctx.toPromptContextAsync({ sources: 'all' });
await ctx.toContextAsync({ history: 3, sources: ['accounts'] });
```

---

### `clear()`

Reset current focus to `null` and fire the `'clear'` event. History is not affected.

```ts
ctx.clear();
```

---

### `subscribe(callback, options?)`

Subscribe to serialized context updates for streaming or long-running AI integrations. The callback receives the latest `ctx.toContext()` output plus the current `AskableFocus | null`. Returns an unsubscribe function.

```ts
const unsubscribe = ctx.subscribe((context, focus) => {
  streamTransport.send({
    type: 'ui-context',
    context,
    focusMeta: focus?.meta ?? null,
  });
}, {
  history: 3,
  debounce: 100,
});

// later
unsubscribe();
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `history` | `number` | `0` | Number of history entries to include in the serialized `toContext()` output |
| `debounce` | `number` | — | Debounce context emissions by N ms |
| `currentLabel` | `string` | `'Current'` | Label for the current focus section |
| `historyLabel` | `string` | `'Recent interactions'` | Label for the history section |
| _...all `AskablePromptContextOptions`_ | | | Passed through to serialization |

Use this when the model/runtime should stay in sync while the user keeps interacting, instead of only reading a one-time snapshot.

---

### `subscribeAsync(callback, options?)`

Subscribe to source-backed serialized context updates for streaming or
long-running AI integrations. The callback receives the latest
`ctx.toContextAsync()` output plus the current `AskableFocus | null`.

```ts
const unsubscribe = ctx.subscribeAsync(async (context, focus) => {
  await streamTransport.send({
    type: 'ui-context',
    context,
    focusMeta: focus?.meta ?? null,
  });
}, {
  history: 3,
  sources: [{ id: 'accounts', mode: 'summary', timeoutMs: 750 }],
  debounce: 100,
  onError(error) {
    reportContextError(error);
  },
});
```

Async subscriptions rerun when focus changes, clear is called, or a matching
source calls `notifyChanged()`. They ignore stale resolver results when a newer
focus or source update happens before an earlier request finishes. Use
`emitInitial: true` when the runtime needs the current context as soon as the
subscription is registered.

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `sources` | `'all' \| Array<string \| AskableContextSourceRequest>` | — | Sources to resolve and append |
| `sourceMode` | `AskableContextSourceMode` | `'summary'` | Default source mode |
| `sourceLabel` | `string` | `'Context sources'` | Natural-language source section label |
| `sourceErrorMode` | `'include' \| 'omit' \| 'throw'` | `'include'` | How failed sources are handled |
| `emitInitial` | `boolean` | `false` | Emit once immediately after registration |
| `onError` | `(error) => void` | — | Handles source or callback failures |
| _...all `AskableContextOutputOptions`_ | | | Passed through to `toContextAsync()` |

---

### `toPromptContext(options?)`

Serialize the current focus to a prompt-ready string. See [Prompt Serialization](/guide/serialization) for full option details.

```ts
ctx.toPromptContext();
// → "User is focused on: — metric: revenue, delta: -12% — value \"Revenue\""

ctx.toPromptContext({ hierarchyDepth: 1 });
// Limit ancestor depth when hierarchical context is available

ctx.toPromptContext({ format: 'json' });
// → '{"meta":{"metric":"revenue","delta":"-12%"},"text":"Revenue","timestamp":1712345678}'

ctx.toPromptContext({ maxTokens: 50 });
// Truncates to ~200 chars and appends [truncated] if needed

ctx.toPromptContext({ excludeKeys: ['_id'], keyOrder: ['metric', 'value'] });
ctx.toPromptContext({ scope: 'analytics' });
```

**Returns:** `string` — `'No UI element is currently focused.'` (or `'null'` for JSON format) when nothing is focused.

---

### `toPromptContextAsync(options?)`

Serialize the current focus plus registered async context sources.

```ts
await ctx.toPromptContextAsync({
  sources: [
    { id: 'accounts', mode: 'summary', timeoutMs: 750 },
    { id: 'calendar', mode: 'selected' },
  ],
  sourceErrorMode: 'include',
});

await ctx.toPromptContextAsync({ sources: 'all', sourceMode: 'summary' });
```

In JSON mode, the output is wrapped as:

```json
{
  "focus": { "meta": { "widget": "accounts-table" }, "text": "Accounts" },
  "sources": [
    {
      "id": "accounts",
      "kind": "collection",
      "mode": "summary",
      "state": { "page": 2, "totalCount": 80 },
      "data": { "atRisk": 4 }
    }
  ]
}
```

Use `toPromptContext()` for synchronous focus-only prompts. Use
`toPromptContextAsync()` when the prompt should include app state, API data,
summaries, selected rows, or other resolver-backed context.

| Option | Type | Default | Description |
|---|---|---|---|
| `sources` | `'all' \| Array<string \| AskableContextSourceRequest>` | — | Sources to resolve and append |
| `sourceMode` | `AskableContextSourceMode` | `'summary'` | Default mode when a source request omits `mode` |
| `sourceLabel` | `string` | `'Context sources'` | Natural-language section label |
| `sourceErrorMode` | `'include' \| 'omit' \| 'throw'` | `'include'` | How failed sources are handled |

---

### `toAgentRequest(question, options?)`

Package a user question with source-backed Askable context for chat and agent
transports. This returns a JSON-ready payload so production apps do not need to
invent a different request shape for each provider.

```ts
const request = await ctx.toAgentRequest('Which accounts need follow-up?', {
  requestId: crypto.randomUUID(),
  history: 3,
  sources: [{ id: 'accounts', mode: 'summary', timeoutMs: 750 }],
  packet: true,
  metadata: {
    route: '/accounts',
  },
});

await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
});
```

On the server, use `isAskableAgentRequest()` before trusting an incoming JSON
body:

```ts
import { isAskableAgentRequest } from '@askable-ui/core';

export async function POST(req: Request) {
  const body = await req.json();
  if (!isAskableAgentRequest(body)) {
    return Response.json({ error: 'Invalid Askable request' }, { status: 400 });
  }

  return askWithContext(body.question, body.context, body.packet);
}
```

The returned object includes:

| Field | Description |
|---|---|
| `question` | User-authored question or instruction |
| `context` | Prompt-ready string from `toContextAsync()` |
| `focus` | Serialized current focus at request creation time |
| `packet` | Optional structured Context packet when `packet` is enabled |
| `requestId` | Optional app-provided tracing id |
| `metadata` | Optional app-provided metadata |
| `timestamp` | Unix timestamp in ms |

Pass `packet: true` to derive packet options from the request options, pass a
full `AskableAsyncContextPacketOptions` object when the packet needs different
privacy, provenance, source, or capture settings than the prompt context, or
pass an existing `WebContextPacket` from a region, circle, lasso, or text
selection capture. Existing packets are attached as-is, which is useful for
"select first, then ask a question" chat composers.

Set `contextFromPacket: true` when that pinned packet should also become the
prompt-ready `context` string. This keeps the user question grounded to the
selected area or highlighted text even if hover/click focus changes while the
composer is open.

Set `selectionFromPacket: true` when registered sources should receive the
packet target as their `selection` input. This lets a source resolve backing app
state for a selected table row, document range, chart region, map feature, or
canvas shape. Explicit `selection` values on individual source requests still
take precedence. When `selectionFromPacket` is enabled, string source includes
use `mode: 'selected'` by default; pass `sourceMode` or an explicit source request
when another mode is needed.

Use `isAskablePacketSourceSelection()` inside a resolver when you need to narrow
that generic `selection` payload:

```ts
import { isAskablePacketSourceSelection } from '@askable-ui/core';

ctx.registerSource('accounts', {
  kind: 'collection',
  resolve({ mode, selection }) {
    if (mode === 'selected' && isAskablePacketSourceSelection(selection)) {
      return getAccountsForSelection(selection.target?.metadata);
    }
    return getAccountsSummary();
  },
});
```

```ts
let pendingPacket: WebContextPacket | null = null;

const lasso = createAskableRegionCapture(ctx, {
  shape: 'lasso',
  onCapture: (packet) => {
    pendingPacket = packet;
    openChatComposer();
  },
});

async function submit(question: string) {
  return ctx.toAgentRequest(question, {
    packet: pendingPacket ?? true,
    contextFromPacket: Boolean(pendingPacket),
    selectionFromPacket: Boolean(pendingPacket),
    sources: ['accounts'],
  });
}
```

---

### `toHistoryContext(limit?, options?)`

Serialize focus history as a numbered, prompt-ready string.

```ts
ctx.toHistoryContext();
// → "[1] User is focused on: ...\n[2] User is focused on: ..."

ctx.toHistoryContext(5);
ctx.toHistoryContext(5, { excludeKeys: ['_id'], maxTokens: 200 });
ctx.toHistoryContext(5, { scope: 'analytics' });
```

**Returns:** `string` — `'No interaction history.'` when history is empty.

---

### `toContext(options?)`

Combined current focus + history in a single prompt-ready string. When `history` is 0 or omitted, output is equivalent to `toPromptContext()` prefixed with a label.

```ts
ctx.toContext();
// → "Current: User is focused on: — metric: revenue — value "Revenue""

ctx.toContext({ history: 5 });
// → "Current: User is focused on: — metric: revenue — value "Revenue"
//
//    Recent interactions:
//    [1] User is focused on: — widget: chart — value "Churn"
//    [2] User is focused on: — page: settings"

ctx.toContext({ history: 3, currentLabel: 'Now', historyLabel: 'Before' });
// Custom section labels
```

**Options (`AskableContextOutputOptions`):**

| Option | Type | Default | Description |
|---|---|---|---|
| `history` | `number` | `0` | Number of history entries to include |
| `currentLabel` | `string` | `'Current'` | Label for the current focus section |
| `historyLabel` | `string` | `'Recent interactions'` | Label for the history section |
| _...all `AskablePromptContextOptions`_ | | | Passed through to serialization |

**Returns:** `string`

---

### `toContextPacket(options?)`

Serialize the current UI state to a structured Context packet for agents,
MCP bridges, browser extensions, or storage.

```ts
const packet = ctx.toContextPacket({
  history: 3,
  includeViewport: true,
  source: { app: 'analytics-dashboard' },
  privacy: { consent: 'explicit' },
});
```

**Options (`AskableContextPacketOptions`):**

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | `Partial<WebContextSource>` | inferred from browser | Override source metadata like app or route |
| `mode` | `WebContextCaptureMode` | inferred | Capture mode for the packet |
| `gesture` | `WebContextGesture` | inferred | Gesture that produced the context |
| `target` | `WebContextTarget` | inferred from focus | Override the packet target for region, circle, lasso, or custom captures |
| `intent` | `string` | — | Optional user intent attached to the capture |
| `includeViewport` | `boolean` | `false` | Include currently visible annotated elements |
| `history` | `number` | `0` | Include recent focus history |
| `privacy` | `Partial<WebContextPrivacy>` | inferred | Redaction and consent metadata |
| `provenance` | `Partial<WebContextProvenance>` | inferred | Producer and capture method metadata |
| _...all `AskablePromptContextOptions`_ | | | Passed through to focus/metadata normalization |

**Returns:** `WebContextPacket`

---

### `toContextPacketAsync(options?)`

Serialize the current UI state plus registered async context sources to a
structured Context packet. Resolved sources are added to
`packet.surrounding.sources`.

```ts
const packet = await ctx.toContextPacketAsync({
  source: { app: 'analytics-dashboard' },
  sources: [{ id: 'accounts', mode: 'summary', maxItems: 20, timeoutMs: 750 }],
  sourceErrorMode: 'include',
});

packet.surrounding?.sources;
// [
//   {
//     label: 'accounts',
//     role: 'collection',
//     metadata: {
//       id: 'accounts',
//       mode: 'summary',
//       state: { ... },
//       data: { ... }
//     }
//   }
// ]
```

Use `toContextPacket()` for synchronous focus/viewport/history packets. Use
`toContextPacketAsync()` when agent runtimes or MCP bridges need resolver-backed
application state in the same structured packet.

| Option | Type | Default | Description |
|---|---|---|---|
| `sources` | `'all' \| Array<string \| AskableContextSourceRequest>` | — | Sources to resolve into `surrounding.sources` |
| `sourceMode` | `AskableContextSourceMode` | `'summary'` | Default mode when a source request omits `mode` |
| `sourceErrorMode` | `'include' \| 'omit' \| 'throw'` | `'include'` | How failed sources are handled |
| _...all `AskableContextPacketOptions`_ | | | Passed through to base packet serialization |

**Returns:** `Promise<WebContextPacket>`

---

### `serializeFocus(options?)`

Returns structured focus data as `AskableSerializedFocus | null`. Same options as `toPromptContext()`.

```ts
const data = ctx.serializeFocus();
// → { meta: { metric: 'revenue' }, text: 'Revenue', timestamp: 1712345678 }
// → null if nothing focused
```

---

### `destroy()`

Fully tear down the context: stops observing, removes all event handlers, and resets state.

```ts
ctx.destroy();
```

---

---

## `createAskableRegionCapture(ctx, options?)`

Mounts a temporary browser overlay that lets the user drag a rectangle, square,
circle, or lasso, then emits a structured Context packet with explicit consent
metadata.

```ts
import {
  ASKABLE_REGION_CAPTURE_THEME,
  createAskableContext,
  createAskableRegionCapture,
} from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const capture = createAskableRegionCapture(ctx, {
  shape: 'lasso',
  intent: 'explain this selected area',
  includeViewport: true,
  selectionAffordance: {
    label: 'Selected context',
    dismissible: true,
    prompt: {
      placeholder: 'Ask about this area...',
      initialValue: 'What should I notice here?',
      onSubmit(question, packet) {
        sendToAgent({ question, context: packet });
      },
    },
  },
  theme: {
    ...ASKABLE_REGION_CAPTURE_THEME,
    lassoStrokeWidth: 4,
    lassoGradientStops: [
      { offset: '0%', color: '#6d28d9' },
      { offset: '78%', color: '#8b5cf6' },
      { offset: '100%', color: '#a78bfa' },
    ],
  },
  onCapture: (packet, selection) => {
    sendToAgent(packet);
    console.log(selection.bounds);
  },
});

capture.start();
```

**Options (`AskableRegionCaptureOptions`):**

| Option | Type | Default | Description |
|---|---|---|---|
| `shape` | `'region' \| 'square' \| 'circle' \| 'lasso'` | `'region'` | Shape produced by the drag gesture |
| `minSize` | `number` | `6` | Minimum accepted width/height in CSS pixels |
| `once` | `boolean` | `true` | Remove the overlay after the first accepted capture |
| `theme` | `Partial<AskableRegionCaptureTheme>` | `ASKABLE_REGION_CAPTURE_THEME` | Overlay colors, selection fill/stroke, and lasso gradient/glow styling |
| `selectionAffordance` | `boolean \| AskableRegionCaptureSelectionAffordanceOptions` | `false` | Keep selected geometry visible after capture, optionally with an anchored prompt |
| `onCapture` | `(packet, selection) => void` | — | Called with the Context packet and selection geometry |
| `onCancel` | `() => void` | — | Called when the capture is cancelled |
| _...most `AskableContextPacketOptions`_ | | | Passed through to `toContextPacket()` |

The default lasso theme is exported as `ASKABLE_REGION_CAPTURE_THEME`. Use
`theme` when your app needs brand-specific capture styling without replacing the
library overlay. The same theme controls persisted selected-state defaults such
as `selectionAffordanceStroke`, `selectionAffordanceFill`, and prompt colors.

`selectionAffordance` is opt-in. Pass `true` to keep the selected shape visible
after capture, or pass an object with `className`, `style`, `label`, `prompt`,
and `render()` hooks. `prompt.onSubmit(question, packet, selection)` is useful
when the selected area should immediately become the anchor for a follow-up chat
question.
Prompt inputs focus and select their initial value by default. Use
`prompt.initialValue` for suggested questions and `prompt.autoFocus: false` to
keep focus where it is.
Pass `dismissible: true` to add a small built-in clear button. Use
`dismissClassName`, `dismissStyle`, `dismissLabel`, and
`onDismiss(packet, selection)` when the selected-context UI needs to update
external chat composer state.
Use `getSelection()` on the handle to read the current pinned packet, selection
geometry, and persisted affordance element. It returns `null` after
`clearSelection()`, dismiss, cancel, or destroy. `lastSelection` values exposed
by framework wrappers remain historical, while `getSelection()` reflects the
currently pinned selected context.

Square captures are constrained to equal width and height. They serialize with
`capture.mode: 'region'` and `target.metadata.shape: 'square'` so existing
region consumers keep working.

Set `once: false` for persistent tools in production dashboards, canvases, and
editors. The overlay stays mounted after each accepted capture, and
`isActive()` remains `true` until `cancel()` or `destroy()` is called.

**Returns:** `AskableRegionCaptureHandle` — object with `start()`, `cancel()`,
`clearSelection()`, `getSelection()`, `destroy()`, and `isActive()` methods.

---

## `createAskableTextSelectionCapture(ctx, options?)`

Listens for highlighted browser text or reads the current selection on demand,
then emits a structured Context packet with explicit consent metadata.

```ts
import {
  ASKABLE_TEXT_SELECTION_CAPTURE_THEME,
  createAskableContext,
  createAskableTextSelectionCapture,
} from '@askable-ui/core';

const ctx = createAskableContext({ viewport: true });
ctx.observe(document);

const selection = createAskableTextSelectionCapture(ctx, {
  intent: 'answer using this highlighted text',
  includeViewport: true,
  selectionAffordance: {
    label: 'Selected text',
    dismissible: true,
    prompt: {
      placeholder: 'Ask about this text...',
      initialValue: 'Explain this quote',
      onSubmit(question, packet) {
        sendToAgent({ question, context: packet });
      },
    },
  },
  theme: {
    ...ASKABLE_TEXT_SELECTION_CAPTURE_THEME,
    selectionFill: 'rgba(124,58,237,0.14)',
  },
  onCapture: (packet, selected) => {
    sendToAgent(packet);
    console.log(selected.text);
  },
});

selection.start();
selection.captureNow();
```

**Options (`AskableTextSelectionCaptureOptions`):**

| Option | Type | Default | Description |
|---|---|---|---|
| `root` | `Document \| HTMLElement` | `document` | Selection root to accept |
| `minLength` | `number` | `1` | Minimum selected text length |
| `debounce` | `number` | `120` | Delay for `selectionchange` captures |
| `once` | `boolean` | `false` | Stop listening after the first accepted capture |
| `dedupe` | `boolean` | `true` | Ignore repeated captures of the same text/bounds |
| `theme` | `Partial<AskableTextSelectionCaptureTheme>` | `ASKABLE_TEXT_SELECTION_CAPTURE_THEME` | Selected-text mark and anchored prompt styling |
| `selectionAffordance` | `boolean \| AskableTextSelectionCaptureAffordanceOptions` | `false` | Keep highlighted text visible after capture, optionally with an anchored prompt |
| `onCapture` | `(packet, selection) => void` | — | Called with the Context packet and selected text details |
| `onCancel` | `() => void` | — | Called when active capture is cancelled |
| _...most `AskableContextPacketOptions`_ | | | Passed through to `toContextPacket()` |

`selectionAffordance` is opt-in. Pass `true` to persist highlighted text marks,
or pass an object with `className`, `style`, `label`, `prompt`, and `render()`
hooks. `prompt.onSubmit(question, packet, selection)` lets a highlighted range
immediately anchor a follow-up chat question.
Prompt inputs focus and select their initial value by default. Use
`prompt.initialValue` for suggested questions and `prompt.autoFocus: false` to
keep focus where it is.
Pass `dismissible: true` to add a built-in clear button. Use
`dismissClassName`, `dismissStyle`, `dismissLabel`, and
`onDismiss(packet, selection)` to keep external selected-context state in sync.
Use `getSelection()` on the handle to read the current pinned packet, selected
text details, and persisted affordance element. It returns `null` after
`clearSelection()`, dismiss, cancel, or destroy.

When browser range geometry is available, the selection includes aggregate
`bounds` plus `rects` for multi-line selected text. Packets include
`target.metadata.rectCount` when rects are present.

**Returns:** `AskableTextSelectionCaptureHandle` — object with `start()`,
`captureNow()`, `cancel()`, `clearSelection()`, `getSelection()`, `destroy()`,
and `isActive()` methods.

---

## `createAskableInspector(ctx, options?)`

Mount a floating inspector panel that shows the active focus, parsed metadata,
prompt output, registered context sources, and optional interaction test tools
in real time. Designed for development and demos.

```ts
import { createAskableContext, createAskableInspector } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document);

const inspector = createAskableInspector(ctx);
// Shows a draggable floating panel in the bottom-right corner with test tools.
// Use Copy to copy the current prompt context exactly as the panel renders it.

createAskableInspector(ctx, {
  sourcePreview: {
    sources: 'all',
    sourceMode: 'summary',
  },
});
// Includes resolved app-owned sources in the Prompt context preview and Copy output.

// Tear down when done:
inspector.destroy();
```

**Options (`AskableInspectorOptions`):**

| Option | Type | Default | Description |
|---|---|---|---|
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Panel anchor position |
| `highlight` | `boolean` | `true` | Outline the focused element |
| `tools` | `boolean` | `true` | Show buttons for region, circle, lasso, text selection, and clear |
| `promptOptions` | `AskablePromptContextOptions` | — | Options passed to `toPromptContext()` for the preview |
| `sourcePreview` | `boolean \| AskableInspectorSourcePreviewOptions` | `false` | Include resolved app-owned sources in the preview and Copy output |

**Returns:** `AskableInspectorHandle` — object with `destroy()` method.

**Notes:**
- No-op in non-browser environments (SSR-safe)
- Calling `createAskableInspector()` a second time replaces any existing panel
- Add it in development only — wrap in `if (process.env.NODE_ENV !== 'production')`

---

## `AskablePromptContextOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `preset` | `'compact' \| 'verbose' \| 'json'` | — | Named shorthand. Individual options override it. |
| `format` | `'natural' \| 'json'` | `'natural'` | Output format |
| `includeText` | `boolean` | `true` | Include element text content |
| `maxTextLength` | `number` | — | Truncate text to N characters |
| `excludeKeys` | `string[]` | — | Omit these keys from object meta |
| `keyOrder` | `string[]` | — | Promote these keys to the front |
| `prefix` | `string` | `'User is focused on:'` | Prefix in natural format |
| `textLabel` | `string` | `'value'` | Label for text field in natural format |
| `maxTokens` | `number` | — | Token budget (4 chars/token). Truncates and appends `[truncated]`. |

**Presets:**

| Preset | Equivalent |
|---|---|
| `compact` | `{ includeText: false, format: 'natural' }` |
| `verbose` | `{ includeText: true, format: 'natural' }` |
| `json` | `{ format: 'json', includeText: true }` |

---

## `a11yTextExtractor`

Built-in accessibility-aware text extractor. Pass it as `textExtractor` to `createAskableContext()` to prefer ARIA labels and accessible names over raw `textContent`.

```ts
import { createAskableContext, a11yTextExtractor } from '@askable-ui/core';

const ctx = createAskableContext({ textExtractor: a11yTextExtractor });
```

**Priority order (returns first non-empty value):**

| Priority | Source | Notes |
|---|---|---|
| 1 | `aria-label` | Highest — explicit author label |
| 2 | `aria-labelledby` | Concatenates referenced elements |
| 3 | `title` | Tooltip/fallback label |
| 4 | `alt` | Images and image inputs |
| 5 | `placeholder` | Input hints |
| 6 | `textContent.trim()` | Default fallback |

See [Accessibility-aware text extraction](/guide/annotating#accessibility-aware-text-extraction) in the guide.
