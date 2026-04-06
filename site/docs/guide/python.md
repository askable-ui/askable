# Python Packages

Askable ships three Python packages. They have different scopes and maturity levels.

## Package overview

| Package | PyPI name | Status | Purpose |
|---|---|---|---|
| `askable-shared` | `askable-shared` | Stable | Serialize focus dicts into prompt-ready strings — mirrors JS core output |
| `askable-django` | `askable-django` | Alpha | Auto-inject Askable JS into HTML responses via middleware + template tags |
| `askable-streamlit` | `askable-streamlit` | Alpha | Streamlit component wrapper for the Askable browser context |

## `askable-shared` — production-ready serializer

The shared serializer is the stable building block for all Python integrations. It receives a focus dict (from your frontend) and formats it for an LLM system prompt.

```python
from askable.serializer import format_prompt_context

focus = {"meta": {"metric": "revenue", "value": "$2.3M"}, "text": "Revenue: $2.3M"}

format_prompt_context(focus)
# → "User is focused on: — metric: revenue, value: $2.3M — value "Revenue: $2.3M""
```

This is fully tested and matches the JavaScript `ctx.toPromptContext()` output. Use it in Django, FastAPI, Flask, or any Python backend that handles chat requests from an Askable-enabled frontend.

See [Python Integration examples](/examples/python) for complete Django and FastAPI patterns.

See the [`askable-shared` API reference](/api/python-shared) for full option docs.

## `askable-django` — early alpha

`askable-django` auto-injects the Askable browser script into HTML responses and provides Django template tags.

::: warning Early alpha
`askable-django` is **not production-ready**. Current scope:
- `AskableMiddleware` — injects Askable JS from CDN before `</body>`
- `{% askable %}` template tag — renders `data-askable` wrappers in Django templates
- `{% askable_script %}` — explicit script injection tag

**Limitations:**
- CDN URL is hardcoded — no offline/self-hosted option yet
- No SSR/hydration integration with HTMX, Turbo, or other Django frontend patterns
- Template tag support is minimal — does not cover all framework features
- Not tested against Django REST Framework or async views
:::

### What `askable-django` is for

It suits traditional server-rendered Django apps where you want to add Askable to an existing template-based app with minimal JS tooling. If you're running a Django backend with a React/Vue/Svelte SPA frontend, use the appropriate JS adapter instead and leave Django as a pure API layer.

### Install

```bash
pip install askable-django
```

```python
# settings.py
INSTALLED_APPS = [
    ...
    'askable',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'askable.middleware.AskableMiddleware',   # injects script automatically
    ...
]
```

### Template tags

```html
{% load askable_tags %}

<!-- Wrap an element with data-askable -->
{% askable meta=chart_data %}<div>{{ chart_html }}</div>{% endaskable %}

<!-- Render just the data-askable attribute -->
<div {% askable_attr meta=chart_data %}>{{ chart_html }}</div>

<!-- Manual script injection (if not using middleware) -->
{% askable_script %}
```

## `askable-streamlit` — early alpha

`askable-streamlit` provides a Streamlit component that renders the Askable browser context capture widget inside a Streamlit iframe.

::: warning Early alpha
`askable-streamlit` is **not production-ready**. Current scope:
- `askable_context()` — renders the browser context component and returns the current focus JSON or `None`

**Limitations:**
- The component only captures context within the Streamlit app iframe — it cannot observe the parent page
- Streamlit's component communication model adds latency compared to native JS integration
- No support for history, hover events, or custom text extraction
- Not suitable for production apps with strict latency requirements
:::

### What `askable-streamlit` is for

Standalone Streamlit apps where the entire UI lives inside Streamlit. If your Streamlit app is embedded in a larger page, use the parent page's JS Askable integration and pass context in via query params instead (see [Python Integration examples](/examples/python)).

### Install

```bash
pip install askable-streamlit
```

```python
import streamlit as st
from askable import askable_context

ctx = askable_context()

if ctx:
    st.write(f"User is looking at: {ctx}")
```

## Recommended approach by stack

| Stack | Recommended integration |
|---|---|
| Django + React/Vue/Svelte SPA | JS adapter in the SPA; Django as API — use `askable-shared` in view |
| Django templates only | `askable-django` (alpha) |
| Streamlit standalone app | Manual sidebar input + `askable-shared` for formatting |
| Streamlit embedded in larger page | Pass context via query params from JS to Streamlit |
| FastAPI / Flask | `askable-shared` in request handler |
| Any backend | `askable-shared` — stable, no framework magic |
