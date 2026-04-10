"""Tests for askable.context — mirrors the TypeScript context.test.ts suite."""

import pytest
from askable import AskableContext, AskableFocus


def make_focus(**kwargs) -> dict:
    defaults = {"meta": {"widget": "test"}, "text": "Test", "source": "dom", "timestamp": 1700000000000}
    return {**defaults, **kwargs}


class TestAskableContext:
    def test_get_focus_returns_none_initially(self):
        ctx = AskableContext()
        assert ctx.get_focus() is None

    def test_receive_sets_focus(self):
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"widget": "revenue", "value": "$2.3M"}, text="Revenue"))
        focus = ctx.get_focus()
        assert focus is not None
        assert focus.meta == {"widget": "revenue", "value": "$2.3M"}
        assert focus.text == "Revenue"
        assert focus.source == "dom"

    def test_push_sets_focus_with_push_source(self):
        ctx = AskableContext()
        ctx.push({"widget": "grid", "row": 3}, "Row 3")
        focus = ctx.get_focus()
        assert focus is not None
        assert focus.meta == {"widget": "grid", "row": 3}
        assert focus.text == "Row 3"
        assert focus.source == "push"

    def test_push_plain_string_meta(self):
        ctx = AskableContext()
        ctx.push("row 5 of deals table")
        assert ctx.get_focus().meta == "row 5 of deals table"

    def test_clear_resets_focus(self):
        ctx = AskableContext()
        ctx.receive(make_focus())
        ctx.clear()
        assert ctx.get_focus() is None

    def test_history_is_newest_first(self):
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"id": "a"}))
        ctx.receive(make_focus(meta={"id": "b"}))
        ctx.receive(make_focus(meta={"id": "c"}))
        history = ctx.get_history()
        assert len(history) == 3
        assert history[0].meta["id"] == "c"
        assert history[1].meta["id"] == "b"
        assert history[2].meta["id"] == "a"

    def test_history_respects_limit(self):
        ctx = AskableContext()
        for i in range(5):
            ctx.receive(make_focus(meta={"id": str(i)}))
        history = ctx.get_history(limit=2)
        assert len(history) == 2
        assert history[0].meta["id"] == "4"

    def test_max_history_caps_buffer(self):
        ctx = AskableContext(max_history=2)
        for i in range(4):
            ctx.receive(make_focus(meta={"id": str(i)}))
        history = ctx.get_history()
        assert len(history) == 2
        assert history[0].meta["id"] == "3"

    def test_max_history_zero_disables_history(self):
        ctx = AskableContext(max_history=0)
        ctx.receive(make_focus())
        assert ctx.get_history() == []

    def test_sanitize_meta_strips_fields(self):
        ctx = AskableContext(sanitize_meta=lambda m: {k: v for k, v in m.items() if k != "secret"})
        ctx.receive(make_focus(meta={"widget": "chart", "secret": "x"}))
        assert "secret" not in ctx.get_focus().meta
        assert ctx.get_focus().meta["widget"] == "chart"

    def test_sanitize_text_masks_content(self):
        import re
        ctx = AskableContext(sanitize_text=lambda t: re.sub(r"\b\d{16}\b", "[card]", t))
        ctx.receive(make_focus(text="4111111111111111"))
        assert ctx.get_focus().text == "[card]"

    def test_to_prompt_context_no_focus(self):
        ctx = AskableContext()
        assert ctx.to_prompt_context() == "No UI element is currently focused."

    def test_to_prompt_context_natural_format(self):
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"metric": "churn", "value": "4.2%"}, text="Churn Rate"))
        prompt = ctx.to_prompt_context()
        assert "User is focused on:" in prompt
        assert "metric: churn" in prompt
        assert "4.2%" in prompt
        assert '"Churn Rate"' in prompt

    def test_to_prompt_context_json_format(self):
        import json
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"widget": "nps"}, text="NPS"))
        parsed = json.loads(ctx.to_prompt_context(format="json"))
        assert parsed["meta"] == {"widget": "nps"}
        assert parsed["text"] == "NPS"

    def test_to_prompt_context_exclude_keys(self):
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"widget": "kpi", "secret": "x"}))
        prompt = ctx.to_prompt_context(exclude_keys=["secret"])
        assert "secret" not in prompt
        assert "kpi" in prompt

    def test_to_prompt_context_no_focus_json(self):
        ctx = AskableContext()
        assert ctx.to_prompt_context(format="json") == "null"

    def test_to_history_context_empty(self):
        ctx = AskableContext()
        assert ctx.to_history_context() == "No interaction history."

    def test_to_history_context_newest_first(self):
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"id": "a"}, text="A"))
        ctx.receive(make_focus(meta={"id": "b"}, text="B"))
        result = ctx.to_history_context()
        lines = result.strip().split("\n")
        assert lines[0].startswith("[1]")
        assert "id: b" in lines[0]
        assert lines[1].startswith("[2]")
        assert "id: a" in lines[1]

    def test_to_context_no_history_equals_to_prompt_context(self):
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"metric": "mrr"}, text="MRR"))
        assert ctx.to_context() == ctx.to_prompt_context()

    def test_to_context_with_history(self):
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"id": "a"}, text="A"))
        ctx.receive(make_focus(meta={"id": "b"}, text="B"))
        out = ctx.to_context(history=5)
        assert "Current:" in out
        assert "Recent interactions:" in out
        assert "id: b" in out
        assert "id: a" in out

    def test_to_context_custom_labels(self):
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"metric": "mrr"}, text="MRR"))
        ctx.receive(make_focus(meta={"metric": "arr"}, text="ARR"))
        out = ctx.to_context(history=1, current_label="Now", history_label="Before")
        assert "Now:" in out
        assert "Before:" in out

    def test_token_budget_truncates(self):
        ctx = AskableContext()
        ctx.receive(make_focus(meta={"description": "A" * 200}))
        prompt = ctx.to_prompt_context(max_tokens=10)
        assert "[truncated]" in prompt
        assert len(prompt) <= 10 * 4
