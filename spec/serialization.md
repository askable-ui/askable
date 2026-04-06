# Serialization Specification

**Version:** 1.0  
**Status:** Stable

This document defines the canonical Askable serialization behavior for `toPromptContext()`, `serializeFocus()`, and `toHistoryContext()`. All language implementations (JS core, Python `askable-shared`) must produce identical output for the same input and options.

## `toPromptContext(options?)`

Serializes the current focus to a prompt-ready string.

### Natural format (default)

```
{prefix} — {metaString} — {textLabel} "{text}"
```

Components:

| Part | Default value | Override |
|---|---|---|
| `prefix` | `"User is focused on:"` | `options.prefix` |
| Separator | `" — "` | Fixed |
| `metaString` | See below | — |
| `textLabel` | `"value"` | `options.textLabel` |
| `text` | Element text content | `textExtractor` at capture time |

**`metaString` rules:**
- Object meta: `key: value` pairs joined with `", "`. Example: `metric: revenue, value: $2.3M`
- String meta: the raw string. Example: `main navigation`

**Text inclusion:**
- If `includeText: false` or text is empty, the `— value "..."` part is omitted.
- If `includeText: true` (default) and text is non-empty, it is appended.

**No-focus output:** `"No UI element is currently focused."`

### JSON format (`format: 'json'`)

Serializes to a JSON string of `AskableSerializedFocus`:

```json
{"meta":{"metric":"revenue","value":"$2.3M"},"text":"Revenue: $2.3M","timestamp":1712345678000}
```

**No-focus output:** `"null"` (string, not JSON null value)

## `serializeFocus(options?)`

Returns a structured `AskableSerializedFocus` object (or `null`), not a string. Applies all the same field filtering as `toPromptContext()` but does not format to natural language.

## `toHistoryContext(limit?, options?)`

Serializes focus history, newest first, as a numbered list:

```
[1] User is focused on: — metric: churn, ...
[2] User is focused on: — metric: revenue, ...
```

Each entry uses the same formatting rules as `toPromptContext()`.

**No-history output:** `"No interaction history."`

## Option semantics

| Option | Type | Default | Behavior |
|---|---|---|---|
| `preset` | `'compact' \| 'verbose' \| 'json'` | — | Named shorthand. See Presets. |
| `format` | `'natural' \| 'json'` | `'natural'` | Output format |
| `includeText` | `boolean` | `true` | Whether text is included |
| `maxTextLength` | `number` | — | Truncate text to N chars before inclusion |
| `excludeKeys` | `string[]` | `[]` | Omit these keys from object meta |
| `keyOrder` | `string[]` | `[]` | Promote listed keys to the front |
| `prefix` | `string` | `"User is focused on:"` | Natural format prefix |
| `textLabel` | `string` | `"value"` | Natural format text label |
| `maxTokens` | `number` | — | Token budget (4 chars/token). Truncates output and appends `[truncated]` |

### `excludeKeys` behavior

Keys listed in `excludeKeys` are removed from the serialized meta object. Applied after `keyOrder`. Does not affect string meta.

### `keyOrder` behavior

Keys listed in `keyOrder` are promoted to the front of the meta object in the specified order. Keys not in `keyOrder` appear after in their original order. Does not affect string meta.

### `maxTokens` behavior

Token budget is approximate: `budget_chars = maxTokens × 4`. If the serialized output exceeds `budget_chars`, it is sliced to `budget_chars - len("[truncated]")` and `"... [truncated]"` is appended.

This applies to the final string output only — it does not truncate individual fields before building the string.

## Presets

Named presets provide shorthand for common option combinations. Individual options specified alongside a preset override the preset's defaults.

| Preset | Equivalent options |
|---|---|
| `compact` | `{ includeText: false, format: 'natural' }` |
| `verbose` | `{ includeText: true, format: 'natural' }` |
| `json` | `{ format: 'json', includeText: true }` |

**Preset + override example:**

```ts
ctx.toPromptContext({ preset: 'compact', includeText: true })
// equivalent to: { includeText: false, format: 'natural', includeText: true }
// resolved:      { includeText: true, format: 'natural' }
```

Individual options always win over preset defaults.

## Cross-language compatibility

The JS `toPromptContext()` and Python `format_prompt_context()` must produce byte-identical output for the same focus dict and options.

Key compatibility rules:
- Object key order in meta: `keyOrder` promoted keys first, then remaining keys in insertion order.
- JSON output: keys are always `meta`, `text` (if present), `timestamp` in that order.
- No-focus: the Python function returns `"No UI element is currently focused."` when `focus` is `None` or empty dict.
- `maxTokens` truncation: `max_chars = max_tokens * 4`; append `"... [truncated]"` (15 chars) after slicing.

## Examples

### Natural, default

```
User is focused on: — metric: revenue, value: $2.3M, delta: +12% — value "Revenue: $2.3M"
```

### Natural, compact preset (no text)

```
User is focused on: — metric: revenue, value: $2.3M, delta: +12%
```

### Natural, custom prefix + textLabel

```
The element: — metric: revenue — label "Revenue: $2.3M"
```

### JSON format

```json
{"meta":{"metric":"revenue","value":"$2.3M","delta":"+12%"},"text":"Revenue: $2.3M","timestamp":1712345678000}
```

### JSON format, no text

```json
{"meta":{"metric":"revenue","value":"$2.3M","delta":"+12%"},"timestamp":1712345678000}
```

### String meta, natural

```
User is focused on: — main navigation — value "Dashboard"
```

### History context (2 entries)

```
[1] User is focused on: — metric: churn, value: 4.2%
[2] User is focused on: — metric: revenue, value: $2.3M
```
