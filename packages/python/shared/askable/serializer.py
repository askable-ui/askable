"""Shared serialization utilities for askable-ui Python packages.

Mirrors the JS core's ``serializeFocus`` / ``toPromptContext`` behaviour in
Python, so server-side code can produce the same output format as the
browser-side SDK.

Typical usage (e.g. after receiving focus data via a POST from the browser)::

    from askable.serializer import format_prompt_context, serialize_focus

    focus = request.json()  # { "meta": {...}, "text": "...", "timestamp": ... }

    # Natural-language string ready for your LLM system prompt:
    context = format_prompt_context(focus)

    # Or get the structured dict for custom formatting:
    data = serialize_focus(focus, exclude_keys=["_internal_id"])
"""

from __future__ import annotations

import json
from typing import Any

# ---------------------------------------------------------------------------
# Preset definitions (mirror JS core PRESETS)
# ---------------------------------------------------------------------------

_PRESETS: dict[str, dict[str, Any]] = {
    "compact": {"include_text": False, "format": "natural"},
    "verbose": {"include_text": True, "format": "natural"},
    "json": {"format": "json", "include_text": True},
}

# Sentinel — distinguishes "user didn't pass this arg" from any real value.
_UNSET = object()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _normalize_meta(
    meta: dict[str, Any],
    *,
    exclude_keys: list[str] | None = None,
    key_order: list[str] | None = None,
) -> dict[str, Any]:
    """Filter and reorder a meta dict, mirroring JS normalizeMeta."""
    excluded = set(exclude_keys or [])
    entries = [(k, v) for k, v in meta.items() if k not in excluded]

    if not key_order:
        return dict(entries)

    def rank(key: str) -> int:
        try:
            return key_order.index(key)
        except ValueError:
            return len(key_order)  # unordered keys go last, stable

    entries.sort(key=lambda kv: rank(kv[0]))
    return dict(entries)


def _normalize_text(text: str, max_text_length: int | None = None) -> str:
    if max_text_length is None:
        return text
    return text[:max(0, max_text_length)]


def _apply_token_budget(output: str, max_tokens: int | None = None) -> str:
    if max_tokens is None:
        return output
    budget = max_tokens * 4
    if len(output) <= budget:
        return output
    marker = "... [truncated]"
    return output[: max(0, budget - len(marker))] + marker


def _resolve_options(preset: str | None, **explicit: Any) -> dict[str, Any]:
    """Merge preset defaults with explicitly-provided kwargs.

    Only kwargs that are *not* the ``_UNSET`` sentinel override the preset.
    This means Python function defaults do not silently clobber preset values.
    """
    base: dict[str, Any] = dict(_PRESETS.get(preset, {})) if preset else {}
    for k, v in explicit.items():
        if v is not _UNSET:
            base[k] = v
    return base


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def serialize_focus(
    focus: dict[str, Any] | None,
    *,
    preset: str | None = None,
    include_text: Any = _UNSET,
    max_text_length: Any = _UNSET,
    exclude_keys: Any = _UNSET,
    key_order: Any = _UNSET,
) -> dict[str, Any] | None:
    """Serialize a focus dict to a structured, prompt-ready dict.

    Args:
        focus: Focus dict as returned by the browser component, with keys
            ``meta`` (dict or str), ``text`` (str), and ``timestamp`` (int).
            Pass ``None`` to get ``None`` back.
        preset: Named preset — ``'compact'``, ``'verbose'``, or ``'json'``.
            Individual keyword arguments override the preset.
        include_text: Include ``text`` in the output. Defaults to ``True``.
        max_text_length: Truncate ``text`` to this many characters.
        exclude_keys: Keys to omit when ``meta`` is a dict.
        key_order: Promote these keys to the front when ``meta`` is a dict.

    Returns:
        A dict with keys ``meta``, optionally ``text``, and ``timestamp``,
        or ``None`` when *focus* is ``None``.
    """
    if focus is None:
        return None

    opts = _resolve_options(
        preset,
        include_text=include_text,
        max_text_length=max_text_length,
        exclude_keys=exclude_keys,
        key_order=key_order,
    )

    meta = focus.get("meta", {})
    if isinstance(meta, dict):
        meta = _normalize_meta(
            meta,
            exclude_keys=opts.get("exclude_keys"),
            key_order=opts.get("key_order"),
        )

    text = focus.get("text", "")
    if opts.get("include_text", True):
        text = _normalize_text(text, opts.get("max_text_length"))
    else:
        text = ""

    result: dict[str, Any] = {"meta": meta}
    if text:
        result["text"] = text
    result["timestamp"] = focus.get("timestamp", 0)
    return result


def format_prompt_context(
    focus: dict[str, Any] | None,
    *,
    preset: str | None = None,
    format: Any = _UNSET,
    include_text: Any = _UNSET,
    max_text_length: Any = _UNSET,
    exclude_keys: Any = _UNSET,
    key_order: Any = _UNSET,
    prefix: Any = _UNSET,
    text_label: Any = _UNSET,
    max_tokens: Any = _UNSET,
) -> str:
    """Serialize a focus dict to a prompt-ready string.

    Mirrors the JS core ``toPromptContext()`` output so Python server-side
    code produces the same format as the browser SDK.

    Args:
        focus: Focus dict (same shape as returned by the Streamlit component
            or a POST payload from the browser).
        preset: Named preset — ``'compact'``, ``'verbose'``, or ``'json'``.
        format: ``'natural'`` (default) or ``'json'``.
        include_text: Include element text in output. Defaults to ``True``.
        max_text_length: Truncate text to this many characters.
        exclude_keys: Omit these keys from object meta.
        key_order: Promote these keys to the front in object meta.
        prefix: Prefix for natural format. Defaults to ``"User is focused on:"``.
        text_label: Label for text in natural format. Defaults to ``"value"``.
        max_tokens: Approximate token budget (4 chars/token). Output is
            truncated with a ``[truncated]`` marker if exceeded.

    Returns:
        A prompt-ready string, or ``'No UI element is currently focused.'``
        (or ``'null'`` for JSON format) when *focus* is ``None``.

    Example::

        focus = {"meta": {"metric": "revenue", "period": "Q3"}, "text": "Revenue: $2.3M", "timestamp": 1712345678}
        print(format_prompt_context(focus))
        # → "User is focused on: — metric: revenue, period: Q3 — value "Revenue: $2.3M""

        print(format_prompt_context(focus, format="json"))
        # → '{"meta": {"metric": "revenue", "period": "Q3"}, "text": "Revenue: $2.3M", "timestamp": 1712345678}'

        print(format_prompt_context(focus, preset="compact"))
        # → "User is focused on: — metric: revenue, period: Q3"
    """
    opts = _resolve_options(
        preset,
        format=format,
        include_text=include_text,
        max_text_length=max_text_length,
        exclude_keys=exclude_keys,
        key_order=key_order,
        prefix=prefix,
        text_label=text_label,
        max_tokens=max_tokens,
    )

    resolved_format = opts.get("format", "natural")
    serialized = serialize_focus(
        focus,
        include_text=opts.get("include_text", _UNSET),
        max_text_length=opts.get("max_text_length", _UNSET),
        exclude_keys=opts.get("exclude_keys", _UNSET),
        key_order=opts.get("key_order", _UNSET),
    )

    if serialized is None:
        output = "null" if resolved_format == "json" else "No UI element is currently focused."
        return output

    if resolved_format == "json":
        output = json.dumps(serialized, ensure_ascii=False)
        return _apply_token_budget(output, opts.get("max_tokens"))

    # Natural format
    resolved_prefix = opts.get("prefix", "User is focused on:")
    resolved_text_label = opts.get("text_label", "value")

    meta = serialized["meta"]
    if isinstance(meta, dict):
        meta_str = ", ".join(f"{k}: {v}" for k, v in meta.items())
    else:
        meta_str = str(meta)

    parts = [resolved_prefix]
    if meta_str:
        parts.append(meta_str)
    if serialized.get("text"):
        parts.append(f'{resolved_text_label} "{serialized["text"]}"')

    output = " \u2014 ".join(parts)
    return _apply_token_budget(output, opts.get("max_tokens"))
