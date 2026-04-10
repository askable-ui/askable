"""
askable-py — server-side context receiver for askable-ui.

The frontend SDK pushes focus events to a configurable HTTP endpoint.
This package receives them, stores the latest state per session, and
exposes a prompt-ready string for injection into LLM calls.

Basic usage::

    from askable import AskableContext

    ctx = AskableContext()
    ctx.receive({
        "meta": {"widget": "deals-table", "rowIndex": 3, "stage": "Closed Won"},
        "text": "Acme Corp — Closed Won — $50k",
        "source": "push",
        "timestamp": 1700000000000,
    })

    prompt = ctx.to_prompt_context()
    # "User is focused on: widget: deals-table, rowIndex: 3, stage: Closed Won — value \"Acme Corp — Closed Won — $50k\""
"""

from .context import AskableContext, AskableFocus

__all__ = ["AskableContext", "AskableFocus"]
__version__ = "0.1.0"
