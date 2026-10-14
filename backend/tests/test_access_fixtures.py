"""Checks the backend access decision against the cases shared with the frontend
(test-fixtures/access.json). The frontend's evaluateAccess runs the same cases
in packages/ui, so both layers must give the same answer for each one.
"""
import json
from pathlib import Path

import pytest

from veloiq_framework.access.decision import evaluate_access

FIXTURES = json.loads(
    (Path(__file__).resolve().parents[2] / "test-fixtures" / "access.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda case: case["name"])
def test_shared_access_case(case):
    ctx = {**FIXTURES["base"], **case["with"]}
    decision = evaluate_access(ctx, case["module_key"], case["model_key"], case["action"])
    assert decision.allowed is case["allowed"]
    if not case["allowed"]:
        assert decision.reason == case["reason"]
