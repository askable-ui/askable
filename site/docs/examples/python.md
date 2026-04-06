# Python Integration

The `askable-shared` Python package mirrors the core serialization API. Use it to parse and format `data-askable` context in Django views, FastAPI routes, or Streamlit apps.

## Install

```bash
pip install askable-shared
```

## Django

A typical setup passes the serialized focus context from the frontend via a POST body, then injects it into the system prompt.

```python
# views.py
import json
import anthropic
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from askable.serializer import format_prompt_context

client = anthropic.Anthropic()

@csrf_exempt
@require_POST
def chat(request):
    body = json.loads(request.body)
    messages = body.get("messages", [])
    ui_context_raw = body.get("uiContext", "")   # serialized by toPromptContext()
    history_raw = body.get("historyContext", "")  # serialized by toHistoryContext()

    system_parts = [
        "You are a helpful analytics assistant.",
    ]
    if ui_context_raw:
        system_parts.append(f"The user is currently looking at:\n{ui_context_raw}")
    if history_raw:
        system_parts.append(f"Recent interactions:\n{history_raw}")

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        system="\n\n".join(system_parts),
        messages=messages,
    )

    return JsonResponse({"text": response.content[0].text})
```

### Parsing structured context on the server

If your frontend sends `ctx.toPromptContext({ format: 'json' })` you can parse and re-format it server-side:

```python
from askable.serializer import serialize_focus, format_prompt_context

# body["context"] is the JSON string from ctx.toPromptContext({ format: 'json' })
focus_dict = json.loads(body["context"])   # { "meta": {...}, "text": "...", "timestamp": ... }

# Re-serialize with Python options
prompt_str = format_prompt_context(
    focus_dict,
    include_text=True,
    exclude_keys=["_internalId"],
    key_order=["metric", "value"],
)
```

### Class-based view

```python
# views.py
import json
import anthropic
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

@method_decorator(csrf_exempt, name='dispatch')
class ChatView(View):
    def post(self, request):
        body = json.loads(request.body)
        ui_context = body.get("uiContext", "")

        client = anthropic.Anthropic()
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=f"You are a helpful assistant.\n\n{ui_context}",
            messages=body.get("messages", []),
        )

        return JsonResponse({"text": response.content[0].text})
```

```python
# urls.py
from django.urls import path
from .views import ChatView

urlpatterns = [
    path("api/chat/", ChatView.as_view()),
]
```

## Streamlit

In a Streamlit app the context travels through `st.session_state` or URL query params (for single-page embedded scenarios). The most common pattern is an embedded iframe: the outer page captures focus and passes it to the Streamlit app via `postMessage` or a shared backend session.

### Standalone Streamlit chat

```python
# app.py
import json
import streamlit as st
import anthropic
from askable.serializer import format_prompt_context

st.title("Analytics Assistant")

# The widget metadata can come from any source: query params, session state, sidebar inputs
with st.sidebar:
    st.header("Active element")
    raw_meta = st.text_area(
        "Paste data-askable JSON (or plain text label)",
        value='{"metric": "revenue", "value": "$2.3M", "delta": "+12%"}',
    )
    text_content = st.text_input("Element text content", value="Revenue: $2.3M")

# Parse the pasted meta
try:
    meta = json.loads(raw_meta)
    focus = {"meta": meta, "text": text_content}
except json.JSONDecodeError:
    focus = {"meta": raw_meta, "text": text_content}   # treat as plain string meta

ui_context = format_prompt_context(focus)
st.caption(f"Context: {ui_context}")

# Chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Ask about this metric…"):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    client = anthropic.Anthropic()
    with st.chat_message("assistant"):
        with st.spinner("Thinking…"):
            response = client.messages.create(
                model="claude-opus-4-6",
                max_tokens=1024,
                system=f"You are a helpful analytics assistant.\n\n{ui_context}",
                messages=st.session_state.messages,
            )
            reply = response.content[0].text
            st.markdown(reply)

    st.session_state.messages.append({"role": "assistant", "content": reply})
```

### Receiving context from a parent page

When Streamlit is embedded in a larger app, pass the serialized focus via query parameter:

```ts
// In your JS app — set the query param when focus changes
ctx.on('focus', () => {
  const context = encodeURIComponent(ctx.toPromptContext());
  const iframe = document.querySelector<HTMLIFrameElement>('#streamlit-frame');
  if (iframe) {
    iframe.src = `/streamlit/?context=${context}`;
  }
});
```

```python
# app.py — receive from query param
from urllib.parse import unquote
import streamlit as st

params = st.query_params
ui_context = unquote(params.get("context", ""))

st.write(f"Focused: {ui_context}")
```

## FastAPI

```python
# main.py
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import anthropic
import json

app = FastAPI()
client = anthropic.Anthropic()

class ChatRequest(BaseModel):
    messages: list[dict]
    ui_context: str = ""
    history_context: str = ""

@app.post("/api/chat")
async def chat(req: ChatRequest):
    system_parts = ["You are a helpful analytics assistant."]
    if req.ui_context:
        system_parts.append(f"The user is looking at:\n{req.ui_context}")
    if req.history_context:
        system_parts.append(f"Recent interactions:\n{req.history_context}")

    def generate():
        with client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=1024,
            system="\n\n".join(system_parts),
            messages=req.messages,
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

## `format_prompt_context` options

The Python serializer supports the same options as the JavaScript `toPromptContext()`:

```python
from askable.serializer import format_prompt_context

focus = {
    "meta": {"metric": "revenue", "value": "$2.3M", "delta": "+12%", "_id": "r-001"},
    "text": "Revenue: $2.3M",
    "timestamp": 1712345678000,
}

# Natural language (default)
format_prompt_context(focus)
# → "User is focused on: — metric: revenue, value: $2.3M, delta: +12% — value "Revenue: $2.3M""

# Exclude internal keys
format_prompt_context(focus, exclude_keys=["_id"])

# Promote important keys to front
format_prompt_context(focus, key_order=["metric", "value"])

# JSON format
format_prompt_context(focus, format="json")
# → '{"meta": {"metric": "revenue", ...}, "text": "Revenue: $2.3M", "timestamp": ...}'

# Compact (no text content)
format_prompt_context(focus, include_text=False)

# Named preset
format_prompt_context(focus, preset="compact")
format_prompt_context(focus, preset="verbose")
format_prompt_context(focus, preset="json")
```
