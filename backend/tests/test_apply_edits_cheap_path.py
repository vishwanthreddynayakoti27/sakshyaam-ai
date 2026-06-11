"""
Unit tests for the no-LLM /apply-edits cheap-path helpers.

The endpoint itself requires DB + auth, so we exercise the in-process
helper `_set_by_path` and the brief-facts cascade in isolation.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routers.staged_upload import _set_by_path  # noqa: E402


class TestSetByPath(unittest.TestCase):

    def test_simple_root_key(self):
        obj = {"sections": "OLD"}
        self.assertTrue(_set_by_path(obj, "sections", "NEW"))
        self.assertEqual(obj["sections"], "NEW")

    def test_nested_dict_path(self):
        obj = {"complainant": {"caste": "OLD"}}
        self.assertTrue(_set_by_path(obj, "complainant.caste", "BC-A"))
        self.assertEqual(obj["complainant"]["caste"], "BC-A")

    def test_creates_missing_intermediate_dicts(self):
        obj = {}
        self.assertTrue(_set_by_path(obj, "io.name", "K Lal Singh"))
        self.assertEqual(obj["io"]["name"], "K Lal Singh")

    def test_list_index_path(self):
        obj = {"accused": [{"name": "John"}, {"name": "Jane"}]}
        self.assertTrue(_set_by_path(obj, "accused[1].name", "Bob"))
        self.assertEqual(obj["accused"][1]["name"], "Bob")
        # Index 0 untouched
        self.assertEqual(obj["accused"][0]["name"], "John")

    def test_witnesses_deeply_nested(self):
        obj = {"witnesses": [
            {"name": "A", "phone": "999"},
            {"name": "B", "phone": "888"},
            {"name": "C", "phone": "777"},
        ]}
        self.assertTrue(_set_by_path(obj, "witnesses[2].phone", "12345"))
        self.assertEqual(obj["witnesses"][2]["phone"], "12345")
        self.assertEqual(obj["witnesses"][0]["phone"], "999")
        self.assertEqual(obj["witnesses"][1]["phone"], "888")

    def test_out_of_bounds_index_returns_false(self):
        obj = {"accused": [{"name": "John"}]}
        self.assertFalse(_set_by_path(obj, "accused[5].name", "Bob"))
        # Object should be untouched
        self.assertEqual(len(obj["accused"]), 1)

    def test_malformed_path_returns_false(self):
        obj = {"x": 1}
        self.assertFalse(_set_by_path(obj, "", "y"))
        self.assertFalse(_set_by_path(obj, "...broken", "y"))

    def test_overwrite_existing_with_empty_string_allowed(self):
        obj = {"complainant": {"phone": "999"}}
        self.assertTrue(_set_by_path(obj, "complainant.phone", ""))
        self.assertEqual(obj["complainant"]["phone"], "")


class TestBriefFactsCascade(unittest.TestCase):
    """The cascade is inline in the endpoint, but verify the pure logic
    (old in bf AND len>=2 AND old!=new → replace) here."""

    def _cascade(self, bf, edits):
        """Mirror the cascade block in routers.staged_upload.apply_edits."""
        if not isinstance(bf, str) or not bf:
            return bf
        for ov, nv in edits:
            ov = (ov or "").strip()
            nv = (nv or "").strip()
            if len(ov) >= 2 and len(nv) >= 2 and ov != nv and ov in bf:
                bf = bf.replace(ov, nv)
        return bf

    def test_replaces_io_name_everywhere(self):
        bf = "LW-12 K Lal Singh registered the case. Later, K Lal Singh examined LW-1."
        out = self._cascade(bf, [("K Lal Singh", "K. Lal Singh")])
        self.assertEqual(out.count("K. Lal Singh"), 2)
        self.assertNotIn("K Lal Singh.", out)

    def test_skips_one_character_old_value(self):
        bf = "A1 went to A2 and then A1 returned"
        # "A1" is too short — would over-replace random text. Reject.
        out = self._cascade(bf, [("A", "Z")])
        self.assertEqual(out, bf)  # unchanged because len(old)<2 is allowed but we test threshold
        # NOTE: our threshold is >=2 so "A1" itself would still be allowed.
        # Verify "A1" (length=2) IS allowed:
        out2 = self._cascade(bf, [("A1", "A99")])
        self.assertIn("A99", out2)

    def test_no_change_when_old_not_present(self):
        bf = "Hello world"
        out = self._cascade(bf, [("Foo", "Bar")])
        self.assertEqual(out, bf)

    def test_no_change_when_old_equals_new(self):
        bf = "Hello world"
        out = self._cascade(bf, [("Hello", "Hello")])
        self.assertEqual(out, bf)

    def test_multi_edit_chain(self):
        bf = "Complainant Aruna lodged petition. K Lal Singh investigated. Aruna confirmed."
        out = self._cascade(bf, [
            ("Aruna", "J. Aruna"),
            ("K Lal Singh", "K. Lal Singh"),
        ])
        self.assertIn("J. Aruna lodged", out)
        self.assertIn("K. Lal Singh", out)
        self.assertEqual(out.count("J. Aruna"), 2)


if __name__ == "__main__":
    unittest.main()
