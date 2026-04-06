# askable-shared (Python)

Shared serialization utilities for askable-ui Python packages. Mirrors the JS core's `serializeFocus` / `toPromptContext` output so server-side Python code produces the same prompt format as the browser SDK.

## Install

```bash
pip install askable-shared
```

Or install from source alongside the Django/Streamlit packages:

```bash
pip install -e packages/python/shared/
```

---

## `serialize_focus(focus, **options)`

Serialize a focus dict to a structured, prompt-ready dict.

```python
from askable.serializer import serialize_focus

focus = {
    "meta": {"metric": "revenue", "period": "Q3", "value": "$2.3M"},
    "text": "Revenue: $2.3M",
    "timestamp": 1712345678000,
}

result = serialize_focus(focus)
# {
#   "meta": {"metric": "revenue", "period": "Q3", "value": "$2.3M"},
#   "text": "Revenue: $2.3M",
#   "timestamp": 1712345678000
# }

serialize_focus(focus, exclude_keys=["period"])
# {"meta": {"metric": "revenue", "value": "$2.3M"}, "text": "Revenue: $2.3M", ...}

serialize_focus(None)
# None
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `focus` | `dict \| None` | — | Focus dict from the browser (keys: `meta`, `text`, `timestamp`) |
| `preset` | `str \| None` | — | Named preset: `'compact'`, `'verbose'`, or `'json'` |
| `include_text` | `bool` | `True` | Include `text` in output |
| `max_text_length` | `int \| None` | — | Truncate `text` to N characters |
| `exclude_keys` | `list[str] \| None` | — | Keys to omit from object meta |
| `key_order` | `list[str] \| None` | — | Keys to promote to the front in object meta |

**Returns:** `dict | None`

---

## `format_prompt_context(focus, **options)`

Serialize a focus dict to a prompt-ready string. Mirrors `ctx.toPromptContext()` from the JS core.

```python
from askable.serializer import format_prompt_context

focus = {
    "meta": {"metric": "revenue", "period": "Q3"},
    "text": "Revenue: $2.3M",
    "timestamp": 1712345678000,
}

format_prompt_context(focus)
# "User is focused on: — metric: revenue, period: Q3 — value "Revenue: $2.3M""

format_prompt_context(focus, format="json")
# '{"meta": {"metric": "revenue", "period": "Q3"}, "text": "Revenue: $2.3M", "timestamp": 1712345678000}'

format_prompt_context(None)
# "No UI element is currently focused."

format_prompt_context(focus, preset="compact")
# "User is focused on: — metric: revenue, period: Q3"
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `focus` | `dict \| None` | — | Focus dict from the browser |
| `preset` | `str \| None` | — | Named preset: `'compact'`, `'verbose'`, or `'json'` |
| `format` | `str` | `'natural'` | Output format: `'natural'` or `'json'` |
| `include_text` | `bool` | `True` | Include element text in output |
| `max_text_length` | `int \| None` | — | Truncate text to N characters |
| `exclude_keys` | `list[str] \| None` | — | Omit these keys from object meta |
| `key_order` | `list[str] \| None` | — | Promote these keys to the front |
| `prefix` | `str` | `'User is focused on:'` | Prefix string for natural format |
| `text_label` | `str` | `'value'` | Label for text in natural format |
| `max_tokens` | `int \| None` | — | Token budget (4 chars/token). Truncates with `[truncated]`. |

**Returns:** `str`

---

## Presets

| Preset | `format` | `include_text` | Use when |
|---|---|---|---|
| `'compact'` | `natural` | `False` | Tight token budgets — meta only |
| `'verbose'` | `natural` | `True` | Rich context — meta + text |
| `'json'` | `json` | `True` | Structured handoff to a tool call or RAG pipeline |

Individual keyword arguments override preset values:

```python
# compact omits text, but explicit include_text=True overrides
format_prompt_context(focus, preset="compact", include_text=True)
```

---

## Usage with Django

```python
# views.py
import json
from django.http import JsonResponse
from askable.serializer import format_prompt_context

def ask_ai(request):
    focus = json.loads(request.body)  # sent by the browser via window.__askableContext
    context = format_prompt_context(focus)

    # pass `context` as the system prompt to your LLM
    return JsonResponse({"prompt": context})
```

## Usage with Streamlit

```python
import streamlit as st
from askable_streamlit import askable_context
from askable.serializer import format_prompt_context

focus = askable_context()
context = format_prompt_context(focus)

if st.button("Ask AI"):
    # pass `context` as the system prompt to your LLM
    st.write(context)
```
