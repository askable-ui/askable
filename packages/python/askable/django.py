"""
Django integration for askable-py.

Provides:
- ``AskableMiddleware`` — stores per-request focus context on ``request.askable``
- ``askable_webhook`` — view that receives focus payloads from the frontend SDK

Usage::

    # settings.py
    MIDDLEWARE = [
        ...
        "askable.django.AskableMiddleware",
    ]

    ASKABLE_ENDPOINT = "/api/askable/"   # default

    # urls.py
    from askable.django import askable_webhook
    urlpatterns = [
        path("api/askable/", askable_webhook, name="askable-webhook"),
        ...
    ]

    # views.py — use in any view after the middleware runs
    def my_view(request):
        prompt = request.askable.to_prompt_context()
        # inject into your LLM call
"""

from __future__ import annotations

import json
from typing import Any, Callable

try:
    from django.http import HttpRequest, JsonResponse
    from django.views.decorators.csrf import csrf_exempt
    from django.views.decorators.http import require_POST
except ImportError as exc:
    raise ImportError(
        "askable.django requires Django. Install it with: pip install askable-py[django]"
    ) from exc

from .context import AskableContext

SESSION_KEY = "_askable_focus"


class AskableMiddleware:
    """
    Django middleware that attaches an ``AskableContext`` to each request.

    The context is populated from the session (persisted across requests)
    and exposed as ``request.askable``.
    """

    def __init__(self, get_response: Callable[[HttpRequest], Any]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> Any:
        ctx = AskableContext()
        # Restore last focus from session if available
        stored = request.session.get(SESSION_KEY)
        if stored:
            try:
                ctx.receive(stored)
            except Exception:
                pass
        request.askable = ctx  # type: ignore[attr-defined]
        response = self.get_response(request)
        return response


@csrf_exempt
@require_POST
def askable_webhook(request: HttpRequest) -> JsonResponse:
    """
    View that receives a focus payload from the frontend SDK and stores it
    in the session so the next request can read it.

    Wire the frontend SDK to POST to this endpoint::

        // main.tsx
        const ctx = createAskableContext();
        ctx.on('focus', (focus) => {
            fetch('/api/askable/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meta: focus.meta,
                    text: focus.text,
                    source: focus.source,
                    timestamp: focus.timestamp,
                }),
            });
        });
    """
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "invalid JSON"}, status=400)

    request.session[SESSION_KEY] = payload
    if hasattr(request, "askable"):
        request.askable.receive(payload)  # type: ignore[attr-defined]

    return JsonResponse({"ok": True})
