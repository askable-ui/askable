"""
Streamlit integration for askable-py.

Provides:
- ``get_context()`` — returns a per-session ``AskableContext`` stored in ``st.session_state``
- ``receive_webhook()`` — helper for Streamlit apps that use a POST endpoint to receive events

Usage::

    import streamlit as st
    from askable.streamlit import get_context

    ctx = get_context()

    # Use in any LLM call
    prompt = ctx.to_prompt_context()
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": f"You are a helpful analyst.\\n\\n{prompt}"},
            {"role": "user", "content": user_input},
        ]
    )
"""

from __future__ import annotations

try:
    import streamlit as st
except ImportError as exc:
    raise ImportError(
        "askable.streamlit requires Streamlit. Install it with: pip install askable-py[streamlit]"
    ) from exc

from .context import AskableContext

SESSION_KEY = "_askable_context"


def get_context(**kwargs: object) -> AskableContext:
    """
    Return the ``AskableContext`` for the current Streamlit session.

    Creates a new context on the first call; returns the existing one on
    subsequent calls (Streamlit re-runs preserve ``st.session_state``).

    :param kwargs: Passed to ``AskableContext.__init__`` on first creation only
                   (e.g. ``max_history``, ``sanitize_meta``).

    Example::

        ctx = get_context(max_history=10)
        prompt = ctx.to_prompt_context()
    """
    if SESSION_KEY not in st.session_state:
        st.session_state[SESSION_KEY] = AskableContext(**kwargs)  # type: ignore[arg-type]
    return st.session_state[SESSION_KEY]  # type: ignore[return-value]


def receive_webhook(payload: dict) -> None:
    """
    Push a focus payload from the frontend SDK into the current session context.

    Call this from a Streamlit route handler or inside a ``st.experimental_fragment``
    that receives POST events.

    :param payload: Deserialized JSON object from the frontend SDK.

    Example (Streamlit + FastAPI hybrid)::

        @app.post("/api/askable/")
        async def askable_endpoint(payload: dict):
            receive_webhook(payload)
            return {"ok": True}
    """
    get_context().receive(payload)
