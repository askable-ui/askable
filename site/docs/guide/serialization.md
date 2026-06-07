# Prompt Serialization

`toPromptContext()`, `toHistoryContext()`, and `toContext()` accept an `AskablePromptContextOptions` object to control exactly how context is serialized. Use `toPromptContextAsync()` or `toContextAsync()` when you also want to include registered app-owned context sources.

## Presets

Named presets are shorthand for common option combinations. Specify a preset via the `preset` option — any individual options you pass alongside it override the preset.

| Preset | Equivalent options | Use case |
|---|---|---|
| `compact` | `{ includeText: false, format: 'natural' }` | Tight token budgets, meta-only |
| `verbose` | `{ includeText: true, format: 'natural' }` | Full natural language (same as default) |
| `json` | `{ format: 'json', includeText: true }` | Structured output for tool calls / storage |

```ts
ctx.toPromptContext({ preset: 'compact' });
// → "User is focused on: — metric: revenue, delta: -12%"

ctx.toPromptContext({ preset: 'json' });
// → '{"meta":{"metric":"revenue","delta":"-12%"},"text":"Revenue","timestamp":...}'

// Individual options override the preset
ctx.toPromptContext({ preset: 'compact', includeText: true });
// compact but with text included
```

Presets work with all serialization methods: `toPromptContext()`, `toHistoryContext()`, `toContext()`, and `serializeFocus()`.

## Default output

```ts
ctx.toPromptContext();
// → "User is focused on: — metric: revenue, delta: -12%, period: Q3 — value "Revenue Chart""
```

When nothing is focused:
```ts
ctx.toPromptContext();
// → "No UI element is currently focused."
```

## Format

### Natural language (default)

```ts
ctx.toPromptContext({ format: 'natural' });
// → "User is focused on: — metric: revenue, delta: -12% — value "Revenue""
```

### JSON

```ts
ctx.toPromptContext({ format: 'json' });
// → '{"meta":{"metric":"revenue","delta":"-12%"},"text":"Revenue","timestamp":1712345678}'

// No focus → 'null'
ctx.toPromptContext({ format: 'json' });
```

## Controlling meta output

### Exclude keys

Strip sensitive or irrelevant keys before serialization:

```ts
ctx.toPromptContext({ excludeKeys: ['_id', 'debug', 'internalRef'] });
```

### Key order

Promote the most important keys to the front of the output:

```ts
ctx.toPromptContext({ keyOrder: ['metric', 'value', 'period'] });
// → "User is focused on: — metric: revenue, value: $128k, period: Q3, ..."
```

Keys not listed in `keyOrder` appear after, in their original order.

## Controlling text

### Omit text

```ts
ctx.toPromptContext({ includeText: false });
// → "User is focused on: — metric: revenue, delta: -12%"
```

### Truncate text

```ts
ctx.toPromptContext({ maxTextLength: 100 });
// text content is sliced to 100 characters
```

## Token budget

`maxTokens` truncates the entire output to an approximate token count using a 4 chars/token estimate. No external tokenizer required.

```ts
ctx.toPromptContext({ maxTokens: 50 });
// If the output exceeds ~200 chars:
// → "User is focused on: — metric: revenue, delta: -12%, period:... [truncated]"
```

This is especially useful for `toHistoryContext()` where multiple entries can accumulate:

```ts
ctx.toHistoryContext(10, { maxTokens: 300 });
// History trimmed to fit ~1200 chars, with [truncated] marker if needed
```

## App-owned sources

DOM context only includes what is rendered. For paginated tables, virtualized
lists, documents, maps, charts, calendars, canvases, or API-backed dashboards,
register a source that resolves data from your application state.

```ts
import {
  createAskableCollectionSource,
  createAskablePageSource,
  createAskableSource,
} from '@askable-ui/core';

ctx.registerSource('accounts', createAskableCollectionSource({
  describe: 'Customer accounts matching the active filters',
  getState: () => ({ filters, sort, page, pageSize, totalCount }),
  getVisibleItems: () => table.getVisibleRows(),
  getSelectedItems: ({ selection }) => getAccountsByIds(selection),
  getItemId: (account) => account.id,
  getItems: () => accountStore.getAllMatching({ filters, sort }),
  getSummary: ({ maxItems }) => summarizeAccounts({ filters, sort, maxItems }),
  sanitizeItem: redactAccountFields,
  sanitize: (source) => ({
    ...source,
    state: redactFilterState(source.state),
  }),
}));

ctx.registerSource('active-chart', createAskableSource({
  kind: 'chart',
  describe: 'Revenue chart',
  state: () => ({ range, segment }),
  modes: {
    summary: () => chart.summary(),
    selected: ({ selection }) => chart.pointsForSelection(selection),
    all: ({ maxItems }) => chart.series().slice(0, maxItems),
  },
}));

ctx.registerSource('page', createAskablePageSource({
  includeLinks: true,
  sanitizeText: redactPageText,
}));

const context = await ctx.toPromptContextAsync({
  sources: [{ id: 'accounts', mode: 'all', maxItems: 20, timeoutMs: 750 }],
  sourceErrorMode: 'include',
});
```

This keeps Askable generic: interaction tools capture what the user meant, and
source resolvers supply what the app knows. `createAskableCollectionSource()`
is useful when the app owns more items than the DOM renders; `mode: 'all'`
asks that source for the logical collection, while `maxItems` keeps prompt
budgets explicit. `createAskableSource()` covers non-collection state like
documents, charts, maps, canvases, or workflows; use `modes` to expose named
slices such as `summary`, `selected`, `all`, or app-defined modes without
writing a custom resolver switch. `ctx.listSources()` returns advertised modes
without resolving data, so chat controls and bridges can offer the right source
mode before sending a prompt. Add `advertisedModes` when a custom resolver
supports modes that are not visible from the factory options.
Source output can be redacted with `sanitizeItem`, a source-level `sanitize`
hook, or a context-level `sanitizeSource` hook. Failed or timed-out sources are
represented with a safe unavailable marker by default; use
`sourceErrorMode: 'omit'` or `'throw'` when your runtime needs stricter
behavior.

For browser extensions and other clients that cannot change the site code,
`createAskablePageSource()` can still expose the page title, URL, selected
text, headings, optional links, and capped full-page text as a normal source.

## Custom labels

```ts
ctx.toPromptContext({
  prefix: 'Active element:',
  textLabel: 'label',
});
// → "Active element: — metric: revenue — label "Revenue Chart""
```

## `serializeFocus()` — structured data

When you need the data before formatting it as a string:

```ts
const data = ctx.serializeFocus();
// → { meta: { metric: 'revenue', delta: '-12%' }, text: 'Revenue', timestamp: 1712345678 }
// → null if nothing focused

// Same options apply
const data = ctx.serializeFocus({ includeText: false, excludeKeys: ['debug'] });
```

Use this to:
- Store focus events in a database
- Build a custom serialization format
- Pass structured data to a tool call / function call instead of a string

## All options at a glance

| Option | Type | Default | Description |
|---|---|---|---|
| `preset` | `'compact' \| 'verbose' \| 'json'` | — | Named shorthand; individual options override it |
| `format` | `'natural' \| 'json'` | `'natural'` | Output format |
| `includeText` | `boolean` | `true` | Include element text content |
| `maxTextLength` | `number` | — | Truncate text to N characters |
| `excludeKeys` | `string[]` | — | Omit these keys from object meta |
| `keyOrder` | `string[]` | — | Promote these keys to the front |
| `prefix` | `string` | `'User is focused on:'` | Prefix in natural format |
| `textLabel` | `string` | `'value'` | Label for text in natural format |
| `maxTokens` | `number` | — | Token budget (4 chars/token estimate). Appends `[truncated]` if exceeded. |

## `toContext()` — combined output

Instead of manually concatenating `toPromptContext()` and `toHistoryContext()`, use `toContext()` to get both in a single call:

```ts
// Replaces this:
const systemPrompt = [
  'Current selection:',
  ctx.toPromptContext(),
  '',
  'Recent interactions:',
  ctx.toHistoryContext(5),
].join('\n');

// With this:
const systemPrompt = ctx.toContext({ history: 5 });
```

All prompt options pass through:

```ts
ctx.toContext({ history: 3, preset: 'compact', maxTokens: 300 });
ctx.toContext({ history: 5, currentLabel: 'Active', historyLabel: 'Previous' });
```
