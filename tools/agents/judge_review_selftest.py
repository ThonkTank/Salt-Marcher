#!/usr/bin/env python3
"""Local selftests for judge_review.py owner-only override handling."""

from __future__ import annotations

import importlib.util
import os
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).with_name("judge_review.py")
SPEC = importlib.util.spec_from_file_location("judge_review", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
judge_review = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(judge_review)


OWNER_EVENT = {
    "event": "labeled",
    "created_at": "2026-07-06T08:00:00Z",
    "label": {"name": "judge-override"},
    "actor": {"login": "ThonkTank"},
}
NON_OWNER_EVENT = {
    "event": "labeled",
    "created_at": "2026-07-06T09:00:00Z",
    "label": {"name": "judge-override"},
    "actor": {"login": "autodev-bot"},
}


@contextmanager
def patched_environ(values: dict[str, str]):
    old = os.environ.copy()
    os.environ.clear()
    os.environ.update(values)
    try:
        yield
    finally:
        os.environ.clear()
        os.environ.update(old)


class JudgeOverrideOwnershipTest(unittest.TestCase):
    def test_claude_code_prompt_uses_stdin_not_argv(self) -> None:
        prompt = "large prompt\n" * 10000
        completed = judge_review.subprocess.CompletedProcess(
            args=["claude"],
            returncode=0,
            stdout="VERDICT: PASS\n",
            stderr="",
        )

        with patched_environ({"CLAUDE_CODE_OAUTH_TOKEN": "oauth-token"}), mock.patch.object(
            judge_review.shutil, "which", return_value="/usr/bin/claude"
        ), mock.patch.object(judge_review.subprocess, "run", return_value=completed) as run:
            self.assertEqual("VERDICT: PASS\n", judge_review.call_claude_code(prompt))

        command = run.call_args.args[0]
        self.assertNotIn(prompt, command)
        self.assertEqual(prompt, run.call_args.kwargs["input"])
        self.assertIn("--input-format", command)

    def test_latest_owner_label_event_authorizes_override(self) -> None:
        events = [
            NON_OWNER_EVENT | {"created_at": "2026-07-06T07:00:00Z"},
            OWNER_EVENT,
        ]

        self.assertTrue(judge_review.owner_set_judge_override(events, "ThonkTank/Salt-Marcher"))

    def test_latest_non_owner_label_event_rejects_override(self) -> None:
        events = [OWNER_EVENT, NON_OWNER_EVENT]

        self.assertFalse(judge_review.owner_set_judge_override(events, "ThonkTank/Salt-Marcher"))

    def test_non_owner_override_runs_judge(self) -> None:
        payload = {
            "pull_request": {
                "number": 20,
                "title": "Follow-up",
                "body": "Normal R1 follow-up",
                "base": {"ref": "main"},
                "labels": [{"name": "risk:R1"}, {"name": "judge-override"}],
            }
        }

        with tempfile.NamedTemporaryFile("w", encoding="utf-8") as event_file:
            event_file.write(judge_review.json.dumps(payload))
            event_file.flush()
            env = {
                "GITHUB_EVENT_PATH": event_file.name,
                "GITHUB_REPOSITORY": "ThonkTank/Salt-Marcher",
                "GITHUB_BASE_REF": "main",
                "GITHUB_TOKEN": "token",
            }
            with patched_environ(env), mock.patch.object(
                judge_review, "fetch_issue_events", return_value=[NON_OWNER_EVENT]
            ), mock.patch.object(judge_review, "diff_text", return_value="diff"), mock.patch.object(
                judge_review, "lens_checklists", return_value="lenses"
            ), mock.patch.object(
                judge_review, "call_anthropic", return_value="VERDICT: PASS"
            ) as call_anthropic:
                self.assertEqual(0, judge_review.main())
                call_anthropic.assert_called_once()

    def test_plain_r1_pr_runs_judge_without_event_lookup(self) -> None:
        payload = {
            "pull_request": {
                "number": 21,
                "title": "Plain R1 follow-up",
                "body": "Normal judge path",
                "base": {"ref": "main"},
                "labels": [{"name": "risk:R1"}],
            }
        }

        with tempfile.NamedTemporaryFile("w", encoding="utf-8") as event_file:
            event_file.write(judge_review.json.dumps(payload))
            event_file.flush()
            env = {
                "GITHUB_EVENT_PATH": event_file.name,
                "GITHUB_REPOSITORY": "ThonkTank/Salt-Marcher",
                "GITHUB_BASE_REF": "main",
            }
            with patched_environ(env), mock.patch.object(
                judge_review, "fetch_issue_events"
            ) as fetch_issue_events, mock.patch.object(
                judge_review, "diff_text", return_value="diff"
            ), mock.patch.object(
                judge_review, "lens_checklists", return_value="lenses"
            ), mock.patch.object(
                judge_review, "call_anthropic", return_value="VERDICT: PASS"
            ) as call_anthropic:
                self.assertEqual(0, judge_review.main())
                fetch_issue_events.assert_not_called()
                call_anthropic.assert_called_once()

    def test_owner_override_skips_judge(self) -> None:
        payload = {
            "pull_request": {
                "number": 20,
                "title": "Override",
                "body": "Owner skip",
                "base": {"ref": "main"},
                "labels": [{"name": "risk:R3c"}, {"name": "judge-override"}],
            }
        }

        with tempfile.NamedTemporaryFile("w", encoding="utf-8") as event_file:
            event_file.write(judge_review.json.dumps(payload))
            event_file.flush()
            env = {
                "GITHUB_EVENT_PATH": event_file.name,
                "GITHUB_REPOSITORY": "ThonkTank/Salt-Marcher",
                "GITHUB_BASE_REF": "main",
                "GITHUB_TOKEN": "token",
            }
            with patched_environ(env), mock.patch.object(
                judge_review, "fetch_issue_events", return_value=[OWNER_EVENT]
            ), mock.patch.object(judge_review, "call_anthropic") as call_anthropic:
                self.assertEqual(0, judge_review.main())
                call_anthropic.assert_not_called()


if __name__ == "__main__":
    unittest.main()
