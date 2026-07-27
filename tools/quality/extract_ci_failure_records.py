#!/usr/bin/env python3
"""Extract a bounded, allowlisted failure record from Gradle JUnit XML."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


MAX_OUTPUT_BYTES = 262_144
FAKE_CREDENTIAL_SENTINEL = "C7_FAKE_CREDENTIAL_SENTINEL_DO_NOT_RETAIN_91A7F0C4"
ALLOWED_INPUT_SUFFIX = ("build", "test-results", "test")
REPO_FRAME = re.compile(
    r"^\s*at\s+((?:app|features|platform|shell)\.[\w.$<>]+\([^\r\n()]+:\d+\))\s*$",
    re.MULTILINE,
)
EXPECTED_ACTUAL = re.compile(
    r"expected:\s*<(.*?)>\s*but was:\s*<(.*?)>", re.DOTALL
)
FORBIDDEN_SELECTED_TEXT = re.compile(
    r"(?:^|[\s'\"])(?:/(?:home|Users|tmp|workspace|github|opt|var|etc)/|[A-Za-z]:\\)",
    re.MULTILINE,
)


class RefusedInput(Exception):
    """The extractor cannot safely emit an allowlisted result."""


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--run-id")
    parser.add_argument("--run-attempt")
    parser.add_argument("--head-sha")
    parser.add_argument("--self-test", action="store_true")
    return parser


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def _validate_input_root(root: Path) -> None:
    if tuple(root.parts[-3:]) != ALLOWED_INPUT_SUFFIX:
        raise RefusedInput
    if root.is_symlink():
        raise RefusedInput


def _selected_text_is_safe(value: str) -> bool:
    return (
        FAKE_CREDENTIAL_SENTINEL not in value
        and FORBIDDEN_SELECTED_TEXT.search(value) is None
    )


def _record(testcase: ET.Element, result: ET.Element) -> dict[str, str]:
    class_name = testcase.get("classname", "")
    method_name = testcase.get("name", "")
    result_type = result.get("type", "")
    message = result.get("message", "")
    body = result.text if result.text is not None else ""
    frame_match = REPO_FRAME.search(body)
    if not all((class_name, method_name, result_type, message, body, frame_match)):
        raise RefusedInput

    values = (class_name, method_name, result_type, message, body, frame_match.group(1))
    if not all(_selected_text_is_safe(value) for value in values):
        raise RefusedInput

    record = {
        "test": f"{class_name}#{method_name}",
        "type": result_type,
        "message": message,
        "body": body,
        "first_repo_frame": frame_match.group(1),
    }
    expected_actual = EXPECTED_ACTUAL.search(message) or EXPECTED_ACTUAL.search(body)
    if expected_actual:
        expected, actual = expected_actual.groups()
        if not _selected_text_is_safe(expected) or not _selected_text_is_safe(actual):
            raise RefusedInput
        record["expected"] = expected
        record["actual"] = actual
    return record


def extract(input_dir: Path, run_id: str, run_attempt: str, head_sha: str) -> bytes | None:
    _validate_input_root(input_dir)
    if (
        not run_id.isdecimal()
        or not run_attempt.isdecimal()
        or not re.fullmatch(r"[0-9a-f]{40}", head_sha)
    ):
        raise RefusedInput
    if not input_dir.is_dir():
        return None

    records: list[dict[str, str]] = []
    xml_files = sorted(input_dir.glob("*.xml"))
    for xml_file in xml_files:
        if xml_file.is_symlink() or not xml_file.is_file():
            raise RefusedInput
        raw = xml_file.read_bytes()
        if FAKE_CREDENTIAL_SENTINEL.encode("ascii") in raw:
            raise RefusedInput
        if b"<!DOCTYPE" in raw or b"<!ENTITY" in raw:
            raise RefusedInput
        root = ET.fromstring(raw)
        for testcase in root.iter("testcase"):
            for result in testcase:
                if result.tag in ("failure", "error"):
                    records.append(_record(testcase, result))

    if not records:
        return None
    document = {
        "schema": 1,
        "run": {"id": run_id, "attempt": run_attempt, "head_sha": head_sha},
        "failures": records,
    }
    payload = (json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n").encode(
        "utf-8"
    )
    if len(payload) > MAX_OUTPUT_BYTES:
        raise RefusedInput
    return payload


def write_atomic(output: Path, payload: bytes | None) -> None:
    _safe_unlink(output)
    if payload is None:
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".records-", dir=output.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, output)
    finally:
        _safe_unlink(temporary)


def _fixture_xml(message: str, body: str, extra: str = "") -> str:
    escaped_message = (
        message.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
    )
    escaped_body = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (
        '<testsuite tests="1" failures="1">'
        '<properties><property name="workspace" value="/never/retain"/></properties>'
        '<testcase classname="app.C7CanaryTest" name="retainsFailure">'
        f'<failure type="org.opentest4j.AssertionFailedError" message="{escaped_message}">'
        f"{escaped_body}</failure></testcase>{extra}</testsuite>"
    )


def self_test() -> None:
    with tempfile.TemporaryDirectory() as temporary_directory:
        root = Path(temporary_directory) / "build" / "test-results" / "test"
        root.mkdir(parents=True)
        output = Path(temporary_directory) / "out" / "records.json"
        body = (
            "org.opentest4j.AssertionFailedError: expected: <left> but was: <right>\n"
            "\tat app.C7CanaryTest.retainsFailure(C7CanaryTest.java:19)\n"
            "\tat org.junit.jupiter.engine.NotRetained.invoke(NotRetained.java:1)"
        )
        xml = _fixture_xml(
            "ordinary failure == expected: <left> but was: <right>",
            body,
            "<system-out>stdout-must-not-appear</system-out>"
            "<system-err>stderr-must-not-appear</system-err>",
        )
        (root / "TEST-app.C7CanaryTest.xml").write_text(xml, encoding="utf-8")
        payload = extract(root, "123", "1", "a" * 40)
        assert payload is not None and len(payload) <= MAX_OUTPUT_BYTES
        write_atomic(output, payload)
        parsed = json.loads(output.read_text(encoding="utf-8"))
        assert set(parsed) == {"schema", "run", "failures"}
        assert set(parsed["run"]) == {"id", "attempt", "head_sha"}
        record = parsed["failures"][0]
        assert set(record) == {
            "test", "type", "message", "body", "first_repo_frame", "expected", "actual"
        }
        assert record["expected"] == "left" and record["actual"] == "right"
        assert record["first_repo_frame"] == "app.C7CanaryTest.retainsFailure(C7CanaryTest.java:19)"
        serialized = output.read_text(encoding="utf-8")
        for forbidden in ("stdout-must-not-appear", "stderr-must-not-appear", "/never/retain"):
            assert forbidden not in serialized

        sentinel_xml = _fixture_xml(FAKE_CREDENTIAL_SENTINEL, body)
        (root / "TEST-app.C7CanaryTest.xml").write_text(sentinel_xml, encoding="utf-8")
        _safe_unlink(output)
        try:
            write_atomic(output, extract(root, "124", "1", "b" * 40))
            raise AssertionError("sentinel input was accepted")
        except RefusedInput:
            pass
        assert not output.exists()

        huge_body = "x" * MAX_OUTPUT_BYTES + "\n\tat app.C7CanaryTest.retainsFailure(C7CanaryTest.java:19)"
        (root / "TEST-app.C7CanaryTest.xml").write_text(
            _fixture_xml("oversize", huge_body), encoding="utf-8"
        )
        try:
            write_atomic(output, extract(root, "125", "1", "c" * 40))
            raise AssertionError("oversize input was accepted")
        except RefusedInput:
            pass
        assert not output.exists()


def main() -> int:
    arguments = _parser().parse_args()
    if arguments.self_test:
        self_test()
        return 0
    if not all(
        (
            arguments.input_dir,
            arguments.output,
            arguments.run_id,
            arguments.run_attempt,
            arguments.head_sha,
        )
    ):
        sys.stderr.write("All extraction arguments are required.\n")
        return 2
    try:
        payload = extract(
            arguments.input_dir, arguments.run_id, arguments.run_attempt, arguments.head_sha
        )
        write_atomic(arguments.output, payload)
        return 0
    except Exception:
        _safe_unlink(arguments.output)
        sys.stderr.write("CI failure record extraction refused input; no output written.\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
