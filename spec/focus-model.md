# Focus Model Specification

**Version:** 1.0  
**Status:** Stable

This document defines the canonical Askable focus model — the data structures that flow through the system when a user interacts with an annotated element.

## Overview

A **focus** is a snapshot of a single user interaction with a `[data-askable]` element. Focus objects are:

- Created at interaction time (click, hover, focus, or explicit `select()` call)
- Passed to sanitizers before storage
- Stored as current focus and appended to history
- Emitted to event subscribers
- Serialized on demand by `toPromptContext()` / `serializeFocus()`

## `AskableFocus`

```ts
interface AskableFocus {
  meta: Record<string, unknown> | string;
  text: string;
  element: HTMLElement;
  timestamp: number;
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `meta` | `Record<string, unknown> \| string` | Parsed value of the `data-askable` attribute. Objects are JSON-parsed; plain strings are stored as-is. |
| `text` | `string` | Text content extracted from the element at capture time. Produced by the active `textExtractor` (default: `element.textContent?.trim() ?? ''`). |
| `element` | `HTMLElement` | Direct reference to the DOM element. Not present in serialized output. |
| `timestamp` | `number` | Unix timestamp in milliseconds (`Date.now()`) recorded at capture time. |

### No-focus state

When nothing has been interacted with, `getFocus()` returns `null`. Serialization methods return:
- Natural format: `"No UI element is currently focused."`
- JSON format: `"null"`
- `serializeFocus()`: `null`

### `data-askable-text` attribute

If the element has a `data-askable-text` attribute, its value is used as `AskableFocus.text` instead of the output of `textExtractor`. An empty string `""` is valid and results in `text: ""`. This attribute takes priority over `textExtractor` and the default `textContent` extraction.

## Meta value rules

1. If `data-askable` is valid JSON, it is parsed to a `Record<string, unknown>`.
2. If parsing fails (or the attribute is not a JSON object), the raw string is used as-is.
3. Empty string `""` is stored as an empty string meta.
4. Arrays and JSON primitives that are not objects are treated as strings (not parsed as `meta`).

## Capture lifecycle

```
DOM event fires
  │
  ├─ targetStrategy resolves the winning element
  │
  ├─ buildFocus(element, textExtractor) → raw AskableFocus
  │     ├─ meta: parse data-askable
  │     ├─ text: textExtractor(element)
  │     └─ timestamp: Date.now()
  │
  ├─ sanitizers applied (sanitizeMeta, sanitizeText) → sanitized AskableFocus
  │
  ├─ stored as currentFocus
  ├─ appended to history (capped at 50)
  └─ emitted as 'focus' event
```

## History

- Maximum 50 entries stored internally.
- `getHistory()` returns entries newest-first.
- History is not cleared by `clear()` — only by `destroy()`.

## `AskableSerializedFocus`

The serialized representation used by `serializeFocus()`:

```ts
interface AskableSerializedFocus {
  meta: Record<string, unknown> | string;
  text?: string;      // omitted when includeText: false or text is empty
  timestamp: number;
}
```

Note: `element` is intentionally excluded — DOM references must not cross client/server boundaries.

## Invariants

- `timestamp` is always a positive integer.
- `text` is always a string (never `null` or `undefined`), though it may be empty.
- `meta` is always either a plain `Record<string, unknown>` or a `string`.
- Focus objects are immutable after creation. Sanitizers receive a copy; they do not mutate the original DOM.
