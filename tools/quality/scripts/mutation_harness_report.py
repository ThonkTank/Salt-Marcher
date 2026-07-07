#!/usr/bin/env python3
"""Run PIT telemetry per behavior-harness area."""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class HarnessInvocation:
    task_name: str
    main_class: str
    args: tuple[str, ...]


@dataclass(frozen=True)
class Area:
    id: str
    pattern: str
    harnesses: tuple[str, ...]
    target_classes: tuple[str, ...]
    target_tests: tuple[HarnessInvocation, ...]


def load_harness_map(path: Path) -> dict[str, list[str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {str(pattern): [str(item) for item in harnesses] for pattern, harnesses in payload.items()}


def parse_harness_invocations(build_file: Path) -> dict[str, HarnessInvocation]:
    text = build_file.read_text(encoding="utf-8")
    result: dict[str, HarnessInvocation] = {}
    for match in re.finditer(r'behaviorHarnesses\.javaExec\("([^"]+)"\)\s*\{', text):
        task_name = match.group(1)
        body = text[match.end(): match.end() + 2500]
        main = re.search(r'mainClass\.set\("([^"]+)"\)', body)
        if main:
            result[task_name] = HarnessInvocation(task_name, main.group(1), ())
    function_start = text.find("fun registerDungeonEditorBehaviorHarnessTask(")
    if function_start >= 0:
        function_prefix = text[function_start: function_start + 4000]
        main = re.search(r'mainClass\.set\("([^"]+)"\)', function_prefix)
        if main:
            for call in function_calls(text, "registerDungeonEditorBehaviorHarnessTask"):
                task_name = first_string_argument(call)
                if task_name:
                    result[task_name] = HarnessInvocation(task_name, main.group(1), first_list_of_strings(call))
    return result


def function_calls(text: str, name: str) -> list[str]:
    calls: list[str] = []
    index = 0
    needle = name + "("
    while True:
        start = text.find(needle, index)
        if start < 0:
            return calls
        depth = 0
        for cursor in range(start + len(name), len(text)):
            char = text[cursor]
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    calls.append(text[start: cursor + 1])
                    index = cursor + 1
                    break
        else:
            return calls


def first_string_argument(call: str) -> str | None:
    match = re.search(r'\(\s*"([^"]+)"', call)
    return match.group(1) if match else None


def first_list_of_strings(call: str) -> tuple[str, ...]:
    match = re.search(r"listOf\((.*?)\)", call, re.DOTALL)
    if not match:
        return ()
    return tuple(re.findall(r'"([^"]+)"', match.group(1)))


def target_class_globs(pattern: str) -> list[str]:
    base = pattern.replace("\\", "/").split("*", 1)[0].rstrip("/")
    if not base or base in {"resources", "gradle"} or base.endswith(".kts"):
        return []
    if base.startswith("src/"):
        return [base.replace("/", ".") + ".*"]
    if base in {"shell", "bootstrap"} or base.startswith(("shell/", "bootstrap/")):
        return [base.replace("/", ".") + ".*"]
    return []


def area_id(pattern: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "-", pattern).strip("-").lower()
    return cleaned or "repo"


def derive_areas(harness_map: dict[str, list[str]], invocations: dict[str, HarnessInvocation]) -> list[Area]:
    areas: list[Area] = []
    for pattern, harnesses in harness_map.items():
        tests = tuple(sorted((invocations[harness] for harness in harnesses if harness in invocations), key=lambda item: item.task_name))
        areas.append(Area(
            id=area_id(pattern),
            pattern=pattern,
            harnesses=tuple(harnesses),
            target_classes=tuple(target_class_globs(pattern)),
            target_tests=tests,
        ))
    return areas


def run_pitest(area: Area, args: argparse.Namespace) -> dict[str, Any]:
    area_dir = args.summaries_dir / area.id
    report_dir = area_dir / "pitest"
    area_dir.mkdir(parents=True, exist_ok=True)
    if not area.target_classes or not area.target_tests:
        return summary(area, "skipped", 0, 0, 0, "No target classes or target tests derived for area.")
    if args.dry_run:
        return summary(area, "dry_run", 0, 0, 0, "Dry run; PIT not executed.")

    classpath = args.pitest_classpath_file.read_text(encoding="utf-8").strip()
    try:
        adapter_classes, adapter_classpath = prepare_adapters(area, classpath, area_dir, args.java)
    except RuntimeError as exc:
        return summary(area, "adapter_failed", 0, 0, 0, str(exc)[-4000:])
    launch_classpath = os.pathsep.join([classpath, str(adapter_classpath)])
    command = [
        args.java,
        "-cp",
        launch_classpath,
        "org.pitest.mutationtest.commandline.MutationCoverageReport",
        "--reportDir",
        str(report_dir),
        "--targetClasses",
        ",".join(area.target_classes),
        "--targetTests",
        ",".join(adapter_classes),
        "--sourceDirs",
        args.source_dirs,
        "--mutableCodePaths",
        args.mutable_code_paths,
        "--mutators",
        "DEFAULTS",
        "--timeoutFactor",
        "2",
        "--threads",
        str(max(1, os.cpu_count() or 1)),
        "--outputFormats",
        "XML",
        "--timestampedReports=false",
        "--failWhenNoMutations=false",
    ]
    env = dict(os.environ)
    xdg_data_home = area_dir / "xdg-data"
    (xdg_data_home / "salt-marcher").mkdir(parents=True, exist_ok=True)
    env["XDG_DATA_HOME"] = str(xdg_data_home)
    try:
        completed = subprocess.run(
            command,
            cwd=REPO_ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            timeout=args.area_timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        output = (exc.stdout or "") if isinstance(exc.stdout, str) else ""
        return summary(area, "pitest_timeout", 0, 0, 0, output[-4000:] + f"\nTimed out after {args.area_timeout_seconds}s.")
    mutations_xml = report_dir / "mutations.xml"
    if completed.returncode != 0:
        return summary(area, "pitest_failed", 0, 0, 0, completed.stdout[-4000:])
    if not mutations_xml.exists():
        return summary(area, "no_report", 0, 0, 0, "PIT completed without mutations.xml.")
    killed, total = parse_mutations(mutations_xml)
    score = 100.0 if total == 0 else (killed * 100.0 / total)
    return summary(area, "ok", killed, total, score, "")


def parse_mutations(path: Path) -> tuple[int, int]:
    root = ET.parse(path).getroot()
    total = 0
    killed = 0
    for mutation in root.iter("mutation"):
        status = str(mutation.attrib.get("status", "")).upper()
        total += 1
        if status == "KILLED":
            killed += 1
    return killed, total


def prepare_adapters(area: Area, classpath: str, area_dir: Path, java: str) -> tuple[list[str], Path]:
    source_dir = area_dir / "adapters-src"
    classes_dir = area_dir / "adapters-classes"
    source_dir.mkdir(parents=True, exist_ok=True)
    classes_dir.mkdir(parents=True, exist_ok=True)
    sources = []
    adapter_classes = []
    for index, invocation in enumerate(area.target_tests):
        adapter_simple_name = "MutationHarnessAdapter" + str(index)
        adapter_class = "saltmarcher.mutation." + adapter_simple_name
        source = source_dir / "saltmarcher" / "mutation" / f"{adapter_simple_name}.java"
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text(adapter_source(adapter_simple_name, invocation.main_class, invocation.args), encoding="utf-8")
        sources.append(str(source))
        adapter_classes.append(adapter_class)
    javac = str(Path(java).with_name("javac")) if "/" in java else "javac"
    completed = subprocess.run(
        [javac, "-cp", classpath, "-d", str(classes_dir), *sources],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stdout)
    return adapter_classes, classes_dir


def adapter_source(simple_name: str, main_class: str, args: tuple[str, ...]) -> str:
    arg_literals = ", ".join(json.dumps(arg) for arg in args)
    return f"""package saltmarcher.mutation;

import org.junit.jupiter.api.Test;

public final class {simple_name} {{
    @Test
    public void runHarness() throws Exception {{
        Class<?> harness = Class.forName("{main_class}");
        harness.getMethod("main", String[].class).invoke(null, (Object) new String[]{{{arg_literals}}});
    }}
}}
"""


def summary(area: Area, status: str, killed: int, total: int, score: float, message: str) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "area": area.pattern,
        "area_id": area.id,
        "harnesses": list(area.harnesses),
        "target_classes": list(area.target_classes),
        "target_tests": [item.main_class for item in area.target_tests],
        "target_harnesses": [
            {"task_name": item.task_name, "main_class": item.main_class, "args": list(item.args)}
            for item in area.target_tests
        ],
        "status": status,
        "mutations_killed": killed,
        "mutations_total": total,
        "mutation_score": round(score, 1),
        "message": message,
    }


def write_summary(summaries_dir: Path, payload: dict[str, Any]) -> None:
    summaries_dir.mkdir(parents=True, exist_ok=True)
    (summaries_dir / f"{payload['area_id']}.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def run(args: argparse.Namespace) -> int:
    harness_map = load_harness_map(args.harness_map)
    invocations = parse_harness_invocations(args.build_gradle)
    areas = derive_areas(harness_map, invocations)
    if args.limit > 0:
        areas = areas[: args.limit]
    for area in areas:
        write_summary(args.summaries_dir, run_pitest(area, args))
    print(f"mutationHarnessReport wrote {len(areas)} area summaries to {args.summaries_dir}")
    return 0


def run_selftest() -> int:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        harness_map = root / "harness-map.json"
        build_file = root / "build.gradle.kts"
        harness_map.write_text(json.dumps({"src/domain/party/**": ["partyDropdownHarness"], "resources/**": ["smokeStartupHarness"]}), encoding="utf-8")
        build_file.write_text('behaviorHarnesses.javaExec("partyDropdownHarness") { task { mainClass.set("src.view.dropdowns.party.PartyDropdownHarness") } }', encoding="utf-8")
        areas = derive_areas(load_harness_map(harness_map), parse_harness_invocations(build_file))
        assert areas[0].target_classes == ("src.domain.party.*",)
        assert areas[0].target_tests[0].main_class == "src.view.dropdowns.party.PartyDropdownHarness"
        assert areas[1].target_classes == ()
        build_file.write_text(
            'fun registerDungeonEditorBehaviorHarnessTask(taskName: String) { behaviorHarnesses.javaExec(taskName) { task { mainClass.set("src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorSuiteHarness") } } }\n'
            'registerDungeonEditorBehaviorHarnessTask("dungeonEditorWallBehaviorHarness", "Run walls", listOf("walls"))\n',
            encoding="utf-8",
        )
        parsed = parse_harness_invocations(build_file)
        assert parsed["dungeonEditorWallBehaviorHarness"].main_class == "src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorSuiteHarness"
        assert parsed["dungeonEditorWallBehaviorHarness"].args == ("walls",)
        assert "new String[]{\"walls\"}" in adapter_source("Adapter", "bootstrap.SmokeStartupHarness", ("walls",))
        xml = root / "mutations.xml"
        xml.write_text('<mutations><mutation status="KILLED"/><mutation status="SURVIVED"/></mutations>', encoding="utf-8")
        assert parse_mutations(xml) == (1, 2)
    print("mutation_harness_report selftest PASS")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--harness-map", type=Path, default=REPO_ROOT / "tools/quality/config/harness-map.json")
    parser.add_argument("--build-gradle", type=Path, default=REPO_ROOT / "build.gradle.kts")
    parser.add_argument("--summaries-dir", type=Path, default=REPO_ROOT / "build/reports/pitest-areas")
    parser.add_argument("--pitest-classpath-file", type=Path, default=REPO_ROOT / "build/reports/pitest-areas/pitest-classpath.txt")
    parser.add_argument("--mutable-code-paths", default="")
    parser.add_argument("--source-dirs", default="bootstrap,shell,src")
    parser.add_argument("--java", default="java")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--area-timeout-seconds", type=int, default=1200)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_selftest()
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
