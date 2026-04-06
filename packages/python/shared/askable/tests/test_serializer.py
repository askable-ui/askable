"""Tests for askable.serializer — mirrors JS core behavior in Python."""

import json
import pytest
from askable.serializer import format_prompt_context, serialize_focus


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

FOCUS = {
    "meta": {"metric": "revenue", "period": "Q3", "value": "$2.3M"},
    "text": "Revenue: $2.3M",
    "timestamp": 1712345678000,
}

STRING_META_FOCUS = {
    "meta": "main navigation",
    "text": "Home | Dashboard | Settings",
    "timestamp": 1712345678001,
}


# ---------------------------------------------------------------------------
# serialize_focus
# ---------------------------------------------------------------------------


class TestSerializeFocus:
    def test_returns_none_for_none_input(self):
        assert serialize_focus(None) is None

    def test_includes_meta_text_timestamp(self):
        result = serialize_focus(FOCUS)
        assert result["meta"] == {"metric": "revenue", "period": "Q3", "value": "$2.3M"}
        assert result["text"] == "Revenue: $2.3M"
        assert result["timestamp"] == 1712345678000

    def test_include_text_false_omits_text(self):
        result = serialize_focus(FOCUS, include_text=False)
        assert "text" not in result

    def test_max_text_length_truncates(self):
        result = serialize_focus(FOCUS, max_text_length=7)
        assert result["text"] == "Revenue"

    def test_exclude_keys_removes_fields(self):
        result = serialize_focus(FOCUS, exclude_keys=["period"])
        assert "period" not in result["meta"]
        assert "metric" in result["meta"]

    def test_key_order_reorders_meta(self):
        result = serialize_focus(FOCUS, key_order=["value", "metric"])
        keys = list(result["meta"].keys())
        assert keys[0] == "value"
        assert keys[1] == "metric"

    def test_string_meta_passed_through(self):
        result = serialize_focus(STRING_META_FOCUS)
        assert result["meta"] == "main navigation"

    def test_exclude_keys_not_applied_to_string_meta(self):
        result = serialize_focus(STRING_META_FOCUS, exclude_keys=["main"])
        # String meta is unchanged
        assert result["meta"] == "main navigation"

    def test_compact_preset_omits_text(self):
        result = serialize_focus(FOCUS, preset="compact")
        assert "text" not in result

    def test_verbose_preset_includes_text(self):
        result = serialize_focus(FOCUS, preset="verbose")
        assert result["text"] == "Revenue: $2.3M"

    def test_json_preset_includes_text(self):
        result = serialize_focus(FOCUS, preset="json")
        assert result["text"] == "Revenue: $2.3M"

    def test_preset_overridden_by_explicit_arg(self):
        # compact sets include_text=False but explicit include_text=True overrides
        result = serialize_focus(FOCUS, preset="compact", include_text=True)
        assert result.get("text") == "Revenue: $2.3M"


# ---------------------------------------------------------------------------
# format_prompt_context — None focus
# ---------------------------------------------------------------------------


class TestFormatPromptContextNoFocus:
    def test_returns_no_focus_string_for_none(self):
        result = format_prompt_context(None)
        assert result == "No UI element is currently focused."

    def test_returns_null_string_for_json_format(self):
        result = format_prompt_context(None, format="json")
        assert result == "null"


# ---------------------------------------------------------------------------
# format_prompt_context — natural format (default)
# ---------------------------------------------------------------------------


class TestFormatPromptContextNatural:
    def test_basic_natural_output(self):
        result = format_prompt_context(FOCUS)
        assert result.startswith("User is focused on:")
        assert "metric: revenue" in result
        assert "Revenue: $2.3M" in result

    def test_no_text_when_include_text_false(self):
        result = format_prompt_context(FOCUS, include_text=False)
        assert "Revenue: $2.3M" not in result
        assert "metric: revenue" in result

    def test_string_meta_in_natural_format(self):
        result = format_prompt_context(STRING_META_FOCUS)
        assert "main navigation" in result

    def test_custom_prefix(self):
        result = format_prompt_context(FOCUS, prefix="Context:")
        assert result.startswith("Context:")

    def test_custom_text_label(self):
        result = format_prompt_context(FOCUS, text_label="selected")
        assert 'selected "Revenue: $2.3M"' in result

    def test_exclude_keys(self):
        result = format_prompt_context(FOCUS, exclude_keys=["period"])
        assert "period" not in result
        assert "metric" in result

    def test_key_order(self):
        result = format_prompt_context(FOCUS, key_order=["value"])
        # "value" should appear before "metric" in the output
        assert result.index("value") < result.index("metric")

    def test_max_text_length(self):
        result = format_prompt_context(FOCUS, max_text_length=7)
        assert '"Revenue"' in result  # truncated to "Revenue"

    def test_compact_preset(self):
        result = format_prompt_context(FOCUS, preset="compact")
        assert "metric: revenue" in result
        assert "Revenue: $2.3M" not in result

    def test_verbose_preset(self):
        result = format_prompt_context(FOCUS, preset="verbose")
        assert "metric: revenue" in result
        assert "Revenue: $2.3M" in result

    def test_preset_overridden_by_explicit(self):
        result = format_prompt_context(FOCUS, preset="compact", include_text=True)
        assert "Revenue: $2.3M" in result


# ---------------------------------------------------------------------------
# format_prompt_context — json format
# ---------------------------------------------------------------------------


class TestFormatPromptContextJson:
    def test_basic_json_output(self):
        result = format_prompt_context(FOCUS, format="json")
        parsed = json.loads(result)
        assert parsed["meta"]["metric"] == "revenue"
        assert parsed["text"] == "Revenue: $2.3M"
        assert parsed["timestamp"] == 1712345678000

    def test_json_preset(self):
        result = format_prompt_context(FOCUS, preset="json")
        parsed = json.loads(result)
        assert "text" in parsed

    def test_json_no_text_when_include_text_false(self):
        result = format_prompt_context(FOCUS, format="json", include_text=False)
        parsed = json.loads(result)
        assert "text" not in parsed

    def test_json_exclude_keys(self):
        result = format_prompt_context(FOCUS, format="json", exclude_keys=["period"])
        parsed = json.loads(result)
        assert "period" not in parsed["meta"]


# ---------------------------------------------------------------------------
# format_prompt_context — token budget
# ---------------------------------------------------------------------------


class TestTokenBudget:
    def test_max_tokens_truncates_output(self):
        long_focus = {
            "meta": {"description": "A" * 500},
            "text": "B" * 500,
            "timestamp": 0,
        }
        result = format_prompt_context(long_focus, max_tokens=10)
        assert len(result) <= 10 * 4 + len("... [truncated]") - 1 + 10  # rough bound
        assert result.endswith("[truncated]")

    def test_no_truncation_when_within_budget(self):
        result = format_prompt_context(FOCUS, max_tokens=1000)
        assert "[truncated]" not in result
