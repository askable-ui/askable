"""
Core context implementation for askable-py.
"""

from __future__ import annotations

import json
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable, Deque, Dict, Literal, Optional, Union


AskableFocusSource = Literal["dom", "select", "push"]


@dataclass
class AskableFocus:
    """A single focus entry — mirrors the TypeScript AskableFocus interface."""

    meta: Union[Dict[str, Any], str]
    text: str
    source: AskableFocusSource
    timestamp: int
    element: None = field(default=None, repr=False)  # always None server-side

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AskableFocus":
        """Deserialize a focus payload from the frontend SDK."""
        return cls(
            meta=data["meta"],
            text=data.get("text", ""),
            source=data.get("source", "dom"),
            timestamp=data.get("timestamp", int(time.time() * 1000)),
        )


class AskableContext:
    """
    Server-side context store for askable-ui focus events.

    The frontend SDK posts focus payloads to your server; call ``receive()``
    with each payload to keep this context up to date.

    Example with Django::

        # views.py
        from django.http import JsonResponse
        from django.views.decorators.csrf import csrf_exempt
        from askable import AskableContext

        ctx = AskableContext()  # one per session in production

        @csrf_exempt
        def askable_webhook(request):
            ctx.receive(json.loads(request.body))
            return JsonResponse({"ok": True})

    Example with Streamlit::

        import streamlit as st
        from askable import AskableContext

        if "askable_ctx" not in st.session_state:
            st.session_state.askable_ctx = AskableContext()

        ctx: AskableContext = st.session_state.askable_ctx
    """

    DEFAULT_MAX_HISTORY = 50

    def __init__(
        self,
        *,
        max_history: int = DEFAULT_MAX_HISTORY,
        sanitize_meta: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
        sanitize_text: Optional[Callable[[str], str]] = None,
    ) -> None:
        self._current: Optional[AskableFocus] = None
        self._history: Deque[AskableFocus] = deque(maxlen=max_history if max_history > 0 else None)
        self._max_history = max_history
        self._sanitize_meta = sanitize_meta
        self._sanitize_text = sanitize_text

    # ------------------------------------------------------------------
    # Receiving focus from the frontend
    # ------------------------------------------------------------------

    def receive(self, payload: Dict[str, Any]) -> None:
        """
        Accept a focus payload posted by the frontend SDK and update context.

        :param payload: Deserialized JSON object from the frontend SDK.
        """
        focus = AskableFocus.from_dict(payload)
        focus = self._apply_sanitizers(focus)
        self._current = focus
        if self._max_history != 0:
            self._history.append(focus)

    def push(
        self,
        meta: Union[Dict[str, Any], str],
        text: str = "",
        source: AskableFocusSource = "push",
    ) -> None:
        """
        Programmatically push focus from server-side data.

        Useful for pre-populating context before the first frontend event.
        """
        focus = AskableFocus(
            meta=meta,
            text=text,
            source=source,
            timestamp=int(time.time() * 1000),
        )
        focus = self._apply_sanitizers(focus)
        self._current = focus
        if self._max_history != 0:
            self._history.append(focus)

    def clear(self) -> None:
        """Reset current focus to None."""
        self._current = None

    # ------------------------------------------------------------------
    # Reading context
    # ------------------------------------------------------------------

    def get_focus(self) -> Optional[AskableFocus]:
        """Return the current focus entry, or None if nothing is focused."""
        return self._current

    def get_history(self, limit: Optional[int] = None) -> list[AskableFocus]:
        """Return history newest-first. Optional limit caps the result."""
        items = list(reversed(self._history))
        return items[:limit] if limit is not None else items

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_prompt_context(
        self,
        *,
        include_text: bool = True,
        format: Literal["natural", "json"] = "natural",
        prefix: str = "User is focused on:",
        text_label: str = "value",
        exclude_keys: Optional[list[str]] = None,
        max_text_length: Optional[int] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Serialize current focus to a prompt-ready string."""
        if not self._current:
            return "null" if format == "json" else "No UI element is currently focused."
        return self._build_prompt_string(
            self._current,
            include_text=include_text,
            format=format,
            prefix=prefix,
            text_label=text_label,
            exclude_keys=exclude_keys or [],
            max_text_length=max_text_length,
            max_tokens=max_tokens,
        )

    def to_history_context(
        self,
        limit: Optional[int] = None,
        **kwargs: Any,
    ) -> str:
        """Serialize focus history to a numbered prompt-ready string (newest first)."""
        history = self.get_history(limit)
        if not history:
            return "No interaction history."
        lines = [f"[{i + 1}] {self._build_prompt_string(f, **kwargs)}" for i, f in enumerate(history)]
        output = "\n".join(lines)
        max_tokens = kwargs.get("max_tokens")
        return self._apply_token_budget(output, max_tokens) if max_tokens else output

    def to_context(
        self,
        *,
        history: int = 0,
        current_label: str = "Current",
        history_label: str = "Recent interactions",
        **kwargs: Any,
    ) -> str:
        """
        Combine current focus and recent history into one prompt-ready string.

        When ``history`` is 0 the output equals ``to_prompt_context()``.
        """
        current_str = self.to_prompt_context(**kwargs)
        if history == 0:
            return current_str

        hist = self.get_history(history)
        parts = [f"{current_label}: {current_str}"]
        if hist:
            lines = [f"[{i + 1}] {self._build_prompt_string(f, **kwargs)}" for i, f in enumerate(hist)]
            parts.append(f"\n{history_label}:\n" + "\n".join(lines))
        output = "\n".join(parts)
        max_tokens = kwargs.get("max_tokens")
        return self._apply_token_budget(output, max_tokens) if max_tokens else output

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _apply_sanitizers(self, focus: AskableFocus) -> AskableFocus:
        meta = focus.meta
        text = focus.text
        if self._sanitize_meta and isinstance(meta, dict):
            meta = self._sanitize_meta(dict(meta))
        if self._sanitize_text:
            text = self._sanitize_text(text)
        if meta is focus.meta and text is focus.text:
            return focus
        return AskableFocus(meta=meta, text=text, source=focus.source, timestamp=focus.timestamp)

    def _build_prompt_string(
        self,
        focus: AskableFocus,
        *,
        include_text: bool = True,
        format: Literal["natural", "json"] = "natural",
        prefix: str = "User is focused on:",
        text_label: str = "value",
        exclude_keys: list[str] = [],
        max_text_length: Optional[int] = None,
        max_tokens: Optional[int] = None,
        **_: Any,
    ) -> str:
        meta = focus.meta
        if isinstance(meta, dict) and exclude_keys:
            meta = {k: v for k, v in meta.items() if k not in exclude_keys}

        text = focus.text
        if max_text_length is not None:
            text = text[:max_text_length]

        if format == "json":
            payload: Dict[str, Any] = {"meta": meta, "timestamp": focus.timestamp}
            if include_text and text:
                payload["text"] = text
            output = json.dumps(payload)
        else:
            if isinstance(meta, str):
                meta_str = meta
            else:
                meta_str = ", ".join(f"{k}: {v}" for k, v in meta.items())

            parts = [prefix]
            if meta_str:
                parts.append(meta_str)
            if include_text and text:
                parts.append(f'{text_label} "{text}"')
            output = " — ".join(parts) if len(parts) > 1 else parts[0]

        return self._apply_token_budget(output, max_tokens) if max_tokens else output

    @staticmethod
    def _apply_token_budget(text: str, max_tokens: Optional[int]) -> str:
        if max_tokens is None:
            return text
        budget = max_tokens * 4
        if len(text) <= budget:
            return text
        marker = "... [truncated]"
        return text[: max(0, budget - len(marker))] + marker
