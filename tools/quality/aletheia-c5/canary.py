#!/usr/bin/env python3
"""Frozen synthetic matrix for the unevaluated C5 crash-safe lease custody."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import random
import resource
import shutil
import signal
import statistics
import subprocess
import sys
import tempfile
import time
from typing import Any, Iterable

SEED = 240426
REPETITIONS = 6
BATCH_SECONDS = 0.35
A_SECONDS = 0.055
POLL_SECONDS = 0.005
DEFER_EXIT = 75
TIMEOUT_EXIT = 124
ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "host-lease-native.c"
WRAPPER = ROOT / "host-lease-native"
WORKER = ROOT / "synthetic-worker"
C2_WRAPPER = Path("/tmp/SaltMarcher-aletheia-c-host-lease/tools/quality/aletheia-c2/host-lease")
C3_WRAPPER = Path("/tmp/SaltMarcher-aletheia-c-host-lease-fd/tools/quality/aletheia-c3/host-lease")
C4_WORKTREE = Path("/tmp/SaltMarcher-aletheia-c-host-lease-native-eval")
C4_SOURCE = C4_WORKTREE / "tools/quality/aletheia-c4/host-lease-native.c"
C4_WRAPPER = ROOT / "known-bad-c4"
C4_ARTIFACT_COMMIT = "cee32886ae10ff36c7d340f1fa73b29b9d94ad91"
BUILD_COMMAND = ["cc", "-std=c17", "-D_POSIX_C_SOURCE=200809L", "-O2", "-Wall", "-Wextra",
                 "-Werror", "-pedantic", "tools/quality/aletheia-c5/host-lease-native.c", "-o",
                 "tools/quality/aletheia-c5/host-lease-native"]
C4_BUILD_COMMAND = ["cc", "-std=c17", "-D_POSIX_C_SOURCE=200809L", "-O2", "-Wall", "-Wextra",
                    "-Werror", "-pedantic", str(C4_SOURCE), "-o", str(C4_WRAPPER)]


def mono_ns() -> int:
    return time.monotonic_ns()


def pid_alive(pid: int) -> bool:
    try:
        stat = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8")
    except (FileNotFoundError, ProcessLookupError):
        return False
    return stat[stat.rfind(")") + 2 :].split()[0] not in {"Z", "X"}


def wait_gone(pid: int, timeout: float = 5.0) -> float:
    started = time.monotonic()
    while time.monotonic() - started <= timeout:
        if not pid_alive(pid):
            return (time.monotonic() - started) * 1000
        time.sleep(POLL_SECONDS)
    return float("inf")


class Harness:
    def __init__(self, runtime: Path):
        self.runtime = runtime
        self.locks = runtime / "locks"
        self.events = runtime / "events.jsonl"
        self.audit = runtime / "audit.log"
        self.env = os.environ.copy()
        self.env.update({
            "ALETHEIA_HOST_LEASE_DIR": str(self.locks),
            "ALETHEIA_HOST_LEASE_AUDIT_LOG": str(self.audit),
        })

    def reset(self) -> None:
        self.events.unlink(missing_ok=True)
        self.audit.unlink(missing_ok=True)

    def command(self, role: str, worker_id: str, duration: float, delay: float = 0.0,
                descendant_pid: Path | None = None, resistant: bool = False,
                leader_exits: bool = False) -> list[str]:
        result = [str(WORKER), str(self.events), role, worker_id, str(duration), str(delay)]
        if descendant_pid is not None:
            result += [str(descendant_pid), "1" if resistant else "0",
                       "1" if leader_exits else "0"]
        return result

    def start(self, mode: str, role: str, worker_id: str, duration: float, *,
              delay: float = 0.0, timeout: float = 3.0,
              descendant_pid: Path | None = None, resistant: bool = False,
              leader_exits: bool = False,
              wrapper: Path | None = None) -> tuple[subprocess.Popen[bytes], int]:
        command = self.command(role, worker_id, duration, delay, descendant_pid, resistant,
                               leader_exits)
        if mode == "candidate":
            chosen = wrapper or WRAPPER
            command = [str(chosen), "a" if role == "A" else "non-a", "--timeout", str(timeout),
                       "--lock-timeout", "2", "--", *command]
        launched = time.time_ns()
        return subprocess.Popen(command, env=self.env, start_new_session=True), launched

    def events_read(self) -> list[dict[str, Any]]:
        if not self.events.exists():
            return []
        return [json.loads(line) for line in self.events.read_text(encoding="utf-8").splitlines() if line]

    def wait_event(self, worker_id: str, event: str = "begin", timeout: float = 4.0) -> dict[str, Any]:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for item in self.events_read():
                if item["id"] == worker_id and item["event"] == event:
                    return item
            time.sleep(POLL_SECONDS)
        raise RuntimeError(f"missing {event} event for {worker_id}")

    def audit_read(self) -> list[dict[str, Any]]:
        if not self.audit.exists():
            return []
        result = []
        for sequence, line in enumerate(self.audit.read_text(encoding="utf-8").splitlines()):
            fields = line.split("|")
            if len(fields) == 2:  # Read-only C2 interoperability calibration.
                event, pid = fields
                result.append({"sequence": sequence, "mono": None, "event": event, "pid": int(pid),
                               "command_pid": None, "watchdog_pid": None, "source": "c2"})
            else:
                mono, event, pid, command, watchdog = fields
                result.append({"sequence": sequence, "mono": float(mono), "event": event, "pid": int(pid),
                               "command_pid": int(command) if command else None,
                               "watchdog_pid": int(watchdog) if watchdog else None, "source": "native-or-c3"})
        return result


def spans(events: Iterable[dict[str, Any]]) -> dict[str, tuple[str, float, float]]:
    partial: dict[str, dict[str, Any]] = {}
    for event in events:
        partial.setdefault(event["id"], {"role": event["role"]})[event["event"]] = event["wall_ns"] / 1e9
    return {key: (value["role"], value["begin"], value["end"])
            for key, value in partial.items() if "begin" in value and "end" in value}


def overlap_pairs(events: Iterable[dict[str, Any]]) -> list[str]:
    intervals = spans(events)
    a = [(key, begin, end) for key, (role, begin, end) in intervals.items() if role == "A"]
    non_a = [(key, begin, end) for key, (role, begin, end) in intervals.items() if role != "A"]
    return sorted(f"{aid}:{bid}" for aid, ab, ae in a for bid, bb, be in non_a if max(ab, bb) < min(ae, be))


def finish(processes: Iterable[subprocess.Popen[bytes]], timeout: float = 8.0) -> list[int]:
    deadline = time.monotonic() + timeout
    return [process.wait(timeout=max(0.01, deadline - time.monotonic())) for process in processes]


def row(h: Harness, scenario: str, mode: str, passed: bool, **metrics: Any) -> dict[str, Any]:
    overlaps = overlap_pairs(h.events_read())
    digest = hashlib.sha256("\n".join(overlaps).encode()).hexdigest() if overlaps else None
    audits = h.audit_read()
    intervals: list[tuple[int, int]] = []
    open_intent: list[int] = []
    for item in audits:
        if item["event"] == "a_intent":
            open_intent.append(item["sequence"])
        elif item["event"] == "a_release" and open_intent:
            intervals.append((open_intent.pop(0), item["sequence"]))
    admissions = sum(any(start <= item["sequence"] <= end for start, end in intervals)
                     for item in audits if item["event"] == "non_a_admitted")
    return {"scenario": scenario, "mode": mode, "pass": bool(passed), "overlap_count": len(overlaps),
            "contaminated_digest": digest, "non_a_admissions_during_a_intent": admissions,
            "audit": audits, **metrics}


def probe(path: Path) -> bool:
    return subprocess.run(["flock", "--exclusive", "--nonblock", str(path), "/bin/true"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def wait_probe(path: Path, timeout: float = 5.0) -> float:
    started = time.monotonic()
    while time.monotonic() - started <= timeout:
        if probe(path):
            return (time.monotonic() - started) * 1000
        time.sleep(POLL_SECONDS)
    return float("inf")


def admitted(h: Harness, mode: str) -> dict[str, Any]:
    h.reset()
    b, _ = h.start(mode, "B", "b", BATCH_SECONDS)
    h.wait_event("b")
    a, launched = h.start(mode, "A", "a", A_SECONDS)
    codes = finish((b, a))
    values = spans(h.events_read())
    wait_ms = (values["a"][1] * 1e9 - launched) / 1e6
    remaining_ms = max(0.0, (values["b"][2] - launched / 1e9) * 1000)
    clean = mode == "baseline" or not overlap_pairs(h.events_read())
    bound = mode == "baseline" or wait_ms <= remaining_ms + 250
    return row(h, "admitted_non_a_then_a", mode, codes == [0, 0] and clean and bound,
               a_wait_ms=wait_ms, remaining_batch_ms=remaining_ms, wait_bound_ok=bound, exits=codes)


def contenders(h: Harness, mode: str) -> dict[str, Any]:
    h.reset()
    b1, _ = h.start(mode, "B", "b1", BATCH_SECONDS)
    h.wait_event("b1")
    processes = [b1]
    if mode == "candidate":
        a, launched = h.start(mode, "A", "a", A_SECONDS)
        deadline = time.monotonic() + 1
        while not any(item["event"] == "a_intent" for item in h.audit_read()) and time.monotonic() < deadline:
            time.sleep(POLL_SECONDS)
        processes.extend(h.start(mode, "B", key, BATCH_SECONDS)[0] for key in ("b2", "c1"))
    else:
        processes.extend(h.start(mode, "B", key, BATCH_SECONDS)[0] for key in ("b2", "c1"))
        a, launched = h.start(mode, "A", "a", A_SECONDS, delay=BATCH_SECONDS * 3.2)
    processes.append(a)
    codes = finish(processes)
    wait_ms = (h.wait_event("a")["wall_ns"] - launched) / 1e6
    clean = mode == "baseline" or not overlap_pairs(h.events_read())
    allowed = {0} if mode == "baseline" else {0, DEFER_EXIT}
    return row(h, "a_with_three_contenders", mode, all(code in allowed for code in codes) and clean,
               a_wait_ms=wait_ms, exits=codes)


def simultaneous(h: Harness, mode: str, a_first: bool) -> dict[str, Any]:
    h.reset()
    order = [("A", "a", A_SECONDS), ("B", "b", BATCH_SECONDS)]
    if not a_first:
        order.reverse()
    started = [h.start(mode, *item)[0] for item in order]
    codes = finish(started)
    allowed = {0} if mode == "baseline" else {0, DEFER_EXIT}
    clean = mode == "baseline" or not overlap_pairs(h.events_read())
    return row(h, "simultaneous_race", mode, all(code in allowed for code in codes) and clean,
               launch_order="a-first" if a_first else "non-a-first", exits=codes)


def recovery(h: Harness, mode: str) -> dict[str, Any]:
    h.reset()
    a1, _ = h.start(mode, "A", "a1", BATCH_SECONDS)
    h.wait_event("a1")
    a2, _ = h.start(mode, "A", "a2", BATCH_SECONDS)
    initial = [h.start(mode, "B", key, BATCH_SECONDS)[0] for key in ("b1", "b2", "c1")]
    initial_codes = finish(initial)
    finish((a1, a2))
    a_end = max(end for role, _, end in spans(h.events_read()).values() if role == "A")
    recovery_start = time.monotonic()
    retry_codes: list[int] = []
    if mode == "candidate":
        pending = ["b1", "b2", "c1"]
        attempt = 0
        while pending and time.monotonic() - recovery_start <= BATCH_SECONDS * 4:
            attempt += 1
            launched = [(key, h.start(mode, "B", f"{key}r{attempt}", BATCH_SECONDS)[0]) for key in pending]
            codes = finish(process for _, process in launched)
            retry_codes.extend(codes)
            pending = [key for (key, _), code in zip(launched, codes) if code == DEFER_EXIT]
    else:
        pending = []
    elapsed_ms = (time.monotonic() - recovery_start) * 1000
    clean = mode == "baseline" or not overlap_pairs(h.events_read())
    initial_ok = mode == "baseline" or initial_codes == [DEFER_EXIT] * 3
    recovery_ok = mode == "baseline" or (not pending and retry_codes.count(0) == 3 and
                                           all(code in {0, DEFER_EXIT} for code in retry_codes) and
                                           elapsed_ms <= BATCH_SECONDS * 4 * 1000)
    return row(h, "sustained_a_then_recovery", mode, initial_ok and recovery_ok and clean,
               initial_exits=initial_codes, retry_exits=retry_codes, recovery_ms=elapsed_ms,
               recovery_bound_ms=BATCH_SECONDS * 4 * 1000, pending_after_bound=pending, a_end_mono=a_end)


def kill_matrix(h: Harness, mode: str) -> dict[str, Any]:
    h.reset()
    if mode == "baseline":
        process, _ = h.start(mode, "B", "base-kill", 10)
        h.wait_event("base-kill"); os.killpg(process.pid, signal.SIGTERM); process.wait()
        return row(h, "kill_waiting_holding_each_lock", mode, True, release_ms=[0.0])
    values: dict[str, float] = {}
    # Holding host.
    process, _ = h.start(mode, "B", "hold-host", 10); h.wait_event("hold-host")
    os.killpg(process.pid, signal.SIGTERM); process.wait(); values["hold_host"] = wait_probe(h.locks / "host")
    # Holding both.
    process, _ = h.start(mode, "A", "hold-both", 10); h.wait_event("hold-both")
    os.killpg(process.pid, signal.SIGTERM); process.wait()
    started = time.monotonic()
    while time.monotonic() - started <= 5 and not (probe(h.locks / "intent") and probe(h.locks / "host")):
        time.sleep(POLL_SECONDS)
    values["hold_both"] = (time.monotonic() - started) * 1000
    # Waiting on intent.
    blocker = subprocess.Popen(["flock", "--exclusive", str(h.locks / "intent"), "/bin/sleep", ".3"])
    time.sleep(.03); process, _ = h.start(mode, "A", "wait-intent", A_SECONDS)
    time.sleep(.03); os.killpg(process.pid, signal.SIGTERM); process.wait(); values["wait_intent"] = wait_probe(h.locks / "host")
    blocker.wait()
    # Holding intent while waiting on host.
    blocker = subprocess.Popen(["flock", "--exclusive", str(h.locks / "host"), "/bin/sleep", ".3"])
    time.sleep(.03); process, _ = h.start(mode, "A", "wait-host", A_SECONDS)
    deadline = time.monotonic() + 1
    while probe(h.locks / "intent") and time.monotonic() < deadline: time.sleep(POLL_SECONDS)
    os.killpg(process.pid, signal.SIGTERM); process.wait(); values["hold_intent_wait_host"] = wait_probe(h.locks / "intent")
    blocker.wait()
    # non-A waiting on host.
    blocker = subprocess.Popen(["flock", "--exclusive", str(h.locks / "host"), "/bin/sleep", ".3"])
    time.sleep(.03); process, _ = h.start(mode, "B", "non-a-wait-host", A_SECONDS)
    time.sleep(.03); os.killpg(process.pid, signal.SIGTERM); process.wait(); blocker.wait()
    values["non_a_wait_host"] = wait_probe(h.locks / "host")
    return row(h, "kill_waiting_holding_each_lock", mode,
               all(value <= 5000 for value in values.values()) and probe(h.locks / "intent") and probe(h.locks / "host"),
               release_ms=values)


def timeout_descendant(h: Harness, mode: str) -> dict[str, Any]:
    h.reset(); pid_path = h.runtime / f"desc-{mode}.pid"; pid_path.unlink(missing_ok=True)
    if mode == "baseline":
        process, _ = h.start(mode, "A", "base-timeout", 10, descendant_pid=pid_path, resistant=True)
        h.wait_event("base-timeout")
        deadline = time.monotonic() + 1
        while not pid_path.exists() and time.monotonic() < deadline: time.sleep(POLL_SECONDS)
        descendant = int(pid_path.read_text())
        os.killpg(process.pid, signal.SIGKILL); process.wait(); gone_ms = wait_gone(descendant)
        return row(h, "timeout_term_resistant_descendant", mode, gone_ms <= 5000,
                   exit=-signal.SIGKILL, descendant_pid=descendant, descendant_gone_ms=gone_ms, release_ms=0.0)
    process, _ = h.start(mode, "A", "timeout", 10, timeout=.18, descendant_pid=pid_path, resistant=True)
    deadline = time.monotonic() + 2
    while not pid_path.exists() and time.monotonic() < deadline: time.sleep(POLL_SECONDS)
    descendant = int(pid_path.read_text())
    started = time.monotonic(); code = process.wait(timeout=4); elapsed_ms = (time.monotonic() - started) * 1000
    gone_ms = wait_gone(descendant); release_ms = max(wait_probe(h.locks / "intent"), wait_probe(h.locks / "host"))
    return row(h, "timeout_term_resistant_descendant", mode,
               code == TIMEOUT_EXIT and gone_ms <= 5000 and release_ms <= 5000,
               exit=code, descendant_pid=descendant, descendant_gone_ms=gone_ms,
               release_ms=release_ms, wait_elapsed_ms=elapsed_ms)


def uncontended(h: Harness, mode: str, role: str) -> dict[str, Any]:
    h.reset(); process, launched = h.start(mode, role, role.lower(), .03)
    code = process.wait(timeout=3); begin = h.wait_event(role.lower())["wall_ns"]
    return row(h, f"uncontended_{role.lower()}", mode, code == 0,
               wall_to_workload_start_ms=(begin - launched) / 1e6, exit=code)


def mixed(h: Harness, a_wrapper: Path, non_a_wrapper: Path, direction: str, a_holds: bool) -> dict[str, Any]:
    h.reset()
    if a_holds:
        a, _ = h.start("candidate", "A", "mixed-a", .2, wrapper=a_wrapper); h.wait_event("mixed-a")
        b, _ = h.start("candidate", "B", "mixed-b", .05, wrapper=non_a_wrapper)
        b_code = b.wait(timeout=3); a_code = a.wait(timeout=3)
        passed = a_code == 0 and b_code == DEFER_EXIT and not overlap_pairs(h.events_read())
    else:
        b, _ = h.start("candidate", "B", "mixed-b", .2, wrapper=non_a_wrapper); h.wait_event("mixed-b")
        a, _ = h.start("candidate", "A", "mixed-a", .05, wrapper=a_wrapper)
        a_code = a.wait(timeout=3); b_code = b.wait(timeout=3)
        passed = a_code == 0 and b_code == 0 and not overlap_pairs(h.events_read())
    return row(h, "mixed_c2_c3_c5_interoperability", direction, passed, exits=[a_code, b_code],
               a_wrapper=str(a_wrapper), non_a_wrapper=str(non_a_wrapper))


def invalid_paths(h: Harness) -> dict[str, Any]:
    h.reset(); root = h.runtime / f"invalid-{time.monotonic_ns()}"; root.mkdir(mode=0o700)
    command = [str(WRAPPER), "a", "--timeout", ".1", "--lock-timeout", ".1", "--", "/bin/true"]
    cases: dict[str, int] = {}
    def execute(name: str, directory: Path) -> None:
        env = h.env.copy(); env["ALETHEIA_HOST_LEASE_DIR"] = str(directory)
        cases[name] = subprocess.run(command, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
    wrong_mode = root / "wrong-mode"; wrong_mode.mkdir(mode=0o755); execute("dir_mode", wrong_mode)
    execute("alternate_owner", Path("/tmp"))
    execute("path_traversal", root / "clean" / ".." / "wrong-mode")
    regular = root / "regular"; regular.write_text("x"); os.chmod(regular, 0o700); execute("dir_type", regular)
    symlink_dir = root / "dir-link"; symlink_dir.symlink_to(wrong_mode); execute("dir_symlink", symlink_dir)
    file_mode = root / "file-mode"; file_mode.mkdir(mode=0o700); (file_mode / "intent").touch(mode=0o644); execute("file_mode", file_mode)
    file_type = root / "file-type"; file_type.mkdir(mode=0o700); (file_type / "intent").mkdir(mode=0o700); execute("file_type", file_type)
    file_link = root / "file-link"; file_link.mkdir(mode=0o700); source = file_link / "intent"; source.touch(mode=0o600)
    os.link(source, file_link / "extra"); execute("file_hardlink", file_link)
    file_symlink = root / "file-symlink"; file_symlink.mkdir(mode=0o700); target = root / "target"; target.touch(mode=0o600)
    (file_symlink / "intent").symlink_to(target); execute("file_symlink", file_symlink)
    return row(h, "invalid_path_rejection", "candidate", all(code == 64 for code in cases.values()), exits=cases)


def contamination_control(h: Harness, scenario: str) -> dict[str, Any]:
    h.reset()
    if scenario == "forced_uncoordinated":
        processes = [h.start("baseline", "A", "a", .16)[0], h.start("baseline", "B", "b", .16)[0]]
    else:
        a, _ = h.start("candidate", "A", "a", .16); h.wait_event("a")
        processes = [a, h.start("baseline", "B", "b", .12)[0]]
    codes = finish(processes); detected = bool(overlap_pairs(h.events_read()))
    return row(h, scenario, "control", detected and codes == [0, 0], detected=detected, exits=codes)


def fd_control(h: Harness) -> dict[str, Any]:
    h.reset(); path = h.locks / "host"; path.parent.mkdir(mode=0o700, exist_ok=True); path.touch(mode=0o600, exist_ok=True)
    def trial(inherit: bool) -> tuple[bool, int]:
        fd = os.open(path, os.O_RDWR); fcntl.flock(fd, fcntl.LOCK_EX)
        process = subprocess.Popen(["/bin/sleep", ".25"], pass_fds=(fd,) if inherit else ())
        os.close(fd); available = probe(path); process.wait()
        return available, process.pid
    omitted_available, omitted_pid = trial(True); correct_available, correct_pid = trial(False)
    return row(h, "direct_fd_closure_control", "control", not omitted_available and correct_available,
               omitted_descendant_blocks=not omitted_available, correct_close_releases=correct_available,
               descendant_pids=[omitted_pid, correct_pid])


def proc_record(pid: int) -> dict[str, Any] | None:
    base = Path(f"/proc/{pid}")
    try:
        stat = (base / "stat").read_text(); tail = stat[stat.rfind(")") + 2 :].split()
        fds = {entry.name: os.readlink(entry) for entry in (base / "fd").iterdir()}
        return {"pid": pid, "ppid": int(tail[1]), "pgid": int(tail[2]),
                "exe": os.readlink(base / "exe"),
                "cmdline": (base / "cmdline").read_bytes().replace(b"\0", b" ").decode(errors="replace").strip(), "fds": fds}
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        return None


def descendants(root: int) -> list[int]:
    found = {root}; changed = True
    while changed:
        changed = False
        for entry in Path("/proc").iterdir():
            if not entry.name.isdigit(): continue
            pid = int(entry.name)
            try:
                stat = (entry / "stat").read_text(); tail = stat[stat.rfind(")") + 2 :].split(); ppid = int(tail[1])
            except (FileNotFoundError, ProcessLookupError, PermissionError, IndexError, ValueError):
                continue
            if ppid in found and pid not in found:
                found.add(pid); changed = True
    return sorted(found)


def topology(h: Harness) -> dict[str, Any]:
    h.reset(); process, _ = h.start("candidate", "A", "topology", .8); h.wait_event("topology")
    command_start = next(item for item in reversed(h.audit_read()) if item["event"] == "command_started")
    command = command_start["command_pid"]
    watchdog = command_start["watchdog_pid"]
    snapshots = []
    for _ in range(3):
        snapshots.append([record for pid in descendants(process.pid) if (record := proc_record(pid))])
        time.sleep(.03)
    code = process.wait(timeout=3)
    lock_targets = {str(h.locks / "intent"), str(h.locks / "host")}
    passed = code == 0
    for snapshot in snapshots:
        supervisors = [item for item in snapshot if item["pid"] == process.pid]
        commands = [item for item in snapshot if item["pid"] == command]
        watchdogs = [item for item in snapshot if item["pid"] == watchdog]
        helper_processes = [item for item in snapshot if Path(item["exe"]) == WRAPPER.resolve()]
        forbidden_helpers = [item for item in snapshot if Path(item["exe"]).name in {"flock", "setsid"}]
        lock_holders = [item for item in snapshot if lock_targets.intersection(item["fds"].values())]
        passed &= len(supervisors) == 1 and len(commands) == 1 and len(watchdogs) == 1
        passed &= {item["pid"] for item in helper_processes} == {process.pid, watchdog}
        passed &= not forbidden_helpers
        passed &= {item["pid"] for item in lock_holders} == {process.pid, watchdog}
        if len(supervisors) == len(commands) == len(watchdogs) == 1:
            supervisor, command_item, watchdog_item = supervisors[0], commands[0], watchdogs[0]
            passed &= command_item["ppid"] == watchdog and command_item["pgid"] == command
            passed &= watchdog_item["ppid"] == process.pid and watchdog_item["pgid"] == watchdog
            passed &= supervisor["pgid"] == process.pid
            supervisor_pipes = {target for target in supervisor["fds"].values() if target.startswith("pipe:[")}
            watchdog_pipes = {target for target in watchdog_item["fds"].values() if target.startswith("pipe:[")}
            command_pipes = {target for target in command_item["fds"].values() if target.startswith("pipe:[")}
            shared_liveness = supervisor_pipes.intersection(watchdog_pipes).difference(command_pipes)
            passed &= len(shared_liveness) == 2
    return row(h, "actual_process_fd_topology", "candidate", passed, snapshots=snapshots, exit=code,
               supervisor_pid=process.pid, command_pid=command, watchdog_pid=watchdog)


def process_group_alive(group: int) -> bool:
    try:
        os.killpg(group, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def wait_group_gone(group: int, timeout: float = 5.0) -> tuple[float, int]:
    started = time.monotonic()
    while time.monotonic() - started <= timeout:
        if not process_group_alive(group):
            return (time.monotonic() - started) * 1000, time.time_ns()
        time.sleep(POLL_SECONDS)
    return float("inf"), time.time_ns()


def fd_targets(pid: int) -> set[str]:
    directory = Path(f"/proc/{pid}/fd")
    try:
        return {os.readlink(entry) for entry in directory.iterdir()}
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        return set()


def custody_snapshot(h: Harness, supervisor: int, command: int, watchdog: int) -> dict[str, Any]:
    targets = {str(h.locks / "intent"), str(h.locks / "host")}
    holders = {pid: sorted(targets.intersection(fd_targets(pid)))
               for pid in (supervisor, command, watchdog)}
    return {"holders": holders,
            "dual_custody": set(holders[supervisor]) == targets and
                            set(holders[watchdog]) == targets and
                            not holders[command]}


def contender_observation(h: Harness, old_group: int, old_descendant: int,
                          contenders: list[subprocess.Popen[bytes]], old_prefix: str,
                          expected_controller: int, wrapper: Path = WRAPPER) -> dict[str, Any]:
    early_workload: list[str] = []
    early_admissions: list[int] = []
    custody_samples = 0
    custody_samples_ok = 0
    started = time.monotonic()
    old_gone_wall_ns = 0
    old_gone_mono = 0.0
    while time.monotonic() - started <= 5.0:
        if not process_group_alive(old_group):
            old_gone_mono = time.monotonic()
            old_gone_wall_ns = time.time_ns()
            break
        custody_samples += 1
        targets = {str(h.locks / "intent"), str(h.locks / "host")}
        if targets.issubset(fd_targets(expected_controller)):
            custody_samples_ok += 1
        early_workload = [item["id"] for item in h.events_read()
                          if item["id"].startswith("contender-") and
                          item["event"] == "begin"]
        early_admissions = [item["pid"] for item in h.audit_read()
                            if item["event"] == "non_a_admitted" and
                            item["pid"] != int(old_prefix)]
        if early_workload or early_admissions:
            # Keep observing until old-group disappearance so the causal
            # ordering remains explicit rather than inferred from lock probes.
            pass
        time.sleep(POLL_SECONDS)
    if not old_gone_wall_ns:
        old_gone_mono = time.monotonic()
        old_gone_wall_ns = time.time_ns()
    old_gone_ms = (time.monotonic() - started) * 1000
    descendant_gone_ms = wait_gone(old_descendant)
    codes = finish(contenders, timeout=8.0)
    retry, _ = h.start("candidate", "B", "recovery-b", .04, wrapper=wrapper)
    retry_code = retry.wait(timeout=3)
    starts = [item for item in h.events_read()
              if item["id"].startswith("contender-") and item["event"] == "begin"]
    starts_before_gone = [item["id"] for item in starts if item["wall_ns"] < old_gone_wall_ns]
    early_admissions = [item["pid"] for item in h.audit_read()
                        if item["event"] == "non_a_admitted" and
                        item["pid"] != int(old_prefix) and item["mono"] is not None and
                        item["mono"] < old_gone_mono]
    return {"old_group_gone_ms": old_gone_ms,
            "old_descendant_gone_ms": descendant_gone_ms,
            "contender_exits": codes,
            "retry_exit": retry_code,
            "starts_before_old_group_gone": starts_before_gone,
            "admissions_before_old_group_gone": early_admissions,
            "custody_samples": custody_samples,
            "custody_samples_ok": custody_samples_ok,
            "ordinary_recovery": all(code in {0, DEFER_EXIT} for code in codes) and
                                 0 in codes and retry_code == 0}


def crash_custody(h: Harness, failure: str, wrapper: Path = WRAPPER,
                  known_bad: bool = False) -> dict[str, Any]:
    h.reset()
    pid_path = h.runtime / f"{failure}-{wrapper.name}-{time.monotonic_ns()}.pid"
    subject, _ = h.start("candidate", "A", "old-a", 10, timeout=8,
                         descendant_pid=pid_path, resistant=True, wrapper=wrapper)
    h.wait_event("old-a")
    deadline = time.monotonic() + 2
    ready_path = Path(f"{pid_path}.ready")
    while (not pid_path.exists() or not ready_path.exists()) and time.monotonic() < deadline:
        time.sleep(POLL_SECONDS)
    if not pid_path.exists() or not ready_path.exists():
        raise RuntimeError(f"TERM-resistant descendant did not become ready: {pid_path}")
    audit = next(item for item in reversed(h.audit_read()) if item["event"] == "command_started")
    command = int(audit["command_pid"])
    watchdog = int(audit["watchdog_pid"])
    descendant = int(pid_path.read_text())
    custody = custody_snapshot(h, subject.pid, command, watchdog)
    killed = subject.pid if failure == "supervisor" else watchdog
    survivor = watchdog if failure == "supervisor" else subject.pid
    os.kill(killed, signal.SIGKILL)
    contenders = [h.start("candidate", "A", "contender-a", .04, wrapper=wrapper)[0],
                  h.start("candidate", "B", "contender-b", .04, wrapper=wrapper)[0]]
    observation = contender_observation(h, command, descendant, contenders,
                                        str(subject.pid), survivor, wrapper)
    subject_code = subject.wait(timeout=3)
    clean = (not observation["starts_before_old_group_gone"] and
             not observation["admissions_before_old_group_gone"])
    custody_held = (observation["custody_samples"] > 0 and
                    observation["custody_samples_ok"] == observation["custody_samples"])
    if known_bad:
        passed = bool(observation["starts_before_old_group_gone"] or
                      observation["admissions_before_old_group_gone"])
        mode = "known-bad-c4"
        scenario = "supervisor_death_known_bad_c4"
    else:
        passed = (custody["dual_custody"] and clean and custody_held and
                  observation["old_group_gone_ms"] <= 5000 and
                  observation["old_descendant_gone_ms"] <= 5000 and
                  observation["ordinary_recovery"] and
                  (failure != "watchdog" or subject_code == 64))
        mode = "candidate"
        scenario = f"{failure}_death_custody"
    return row(h, scenario, mode, passed, pre_failure_custody=custody,
               killed_pid=killed, survivor_pid=survivor, subject_exit=subject_code,
               **observation)


def normal_group_quiescence(h: Harness) -> dict[str, Any]:
    h.reset()
    pid_path = h.runtime / f"normal-quiescence-{time.monotonic_ns()}.pid"
    subject, _ = h.start("candidate", "A", "old-normal", .01, timeout=8,
                         descendant_pid=pid_path, resistant=True, leader_exits=True)
    h.wait_event("old-normal")
    deadline = time.monotonic() + 2
    ready_path = Path(f"{pid_path}.ready")
    while (not pid_path.exists() or not ready_path.exists()) and time.monotonic() < deadline:
        time.sleep(POLL_SECONDS)
    if not pid_path.exists() or not ready_path.exists():
        raise RuntimeError(f"normal-quiescence descendant did not become ready: {pid_path}")
    audit = next(item for item in reversed(h.audit_read()) if item["event"] == "command_started")
    command = int(audit["command_pid"])
    descendant = int(pid_path.read_text())
    contenders = [h.start("candidate", "A", "contender-a", .04)[0],
                  h.start("candidate", "B", "contender-b", .04)[0]]
    observation = contender_observation(h, command, descendant, contenders,
                                        str(subject.pid), subject.pid)
    subject_code = subject.wait(timeout=3)
    passed = (not observation["starts_before_old_group_gone"] and
              not observation["admissions_before_old_group_gone"] and
              observation["custody_samples"] > 0 and
              observation["custody_samples_ok"] == observation["custody_samples"] and
              observation["old_group_gone_ms"] <= 5000 and
              observation["old_descendant_gone_ms"] <= 5000 and
              observation["ordinary_recovery"] and subject_code == 0)
    return row(h, "normal_completion_group_quiescence", "candidate", passed,
               supervisor_pid=subject.pid, command_pid=command, descendant_pid=descendant,
               subject_exit=subject_code, **observation)


def stats(values: list[float]) -> dict[str, float]:
    ordered = sorted(values)
    return {"median": statistics.median(ordered), "p95": ordered[math.ceil(.95 * len(ordered)) - 1],
            "max": max(ordered), "population_stdev": statistics.pstdev(ordered)}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def summarize(rows: list[dict[str, Any]], wall: float, cpu: float, compile_wall: float,
              raw_path: Path, summary_path: Path) -> dict[str, Any]:
    recorded = [item for item in rows if item["phase"] == "recorded"]
    candidate = [item for item in recorded if item["mode"] == "candidate"]
    controls = [item for item in recorded if item["mode"] == "control"]
    numeric: dict[str, dict[str, Any]] = {}
    for key in sorted({(item["scenario"], item["mode"]) for item in recorded}):
        group = [item for item in recorded if (item["scenario"], item["mode"]) == key]
        metrics: dict[str, Any] = {"count": len(group), "pass_count": sum(item["pass"] for item in group)}
        names = sorted(set().union(*(item.keys() for item in group)))
        for name in names:
            values = [float(item[name]) for item in group if isinstance(item.get(name), (int, float)) and not isinstance(item.get(name), bool)]
            if len(values) == len(group) and values: metrics[name] = stats(values)
        numeric["|".join(key)] = metrics
    def count(scenario: str, key: str = "pass") -> int:
        return sum(bool(item.get(key)) for item in recorded if item["scenario"] == scenario)
    a_overheads = [item["wall_to_workload_start_ms"] for item in candidate if item["scenario"] == "uncontended_a"]
    b_overheads = [item["wall_to_workload_start_ms"] for item in candidate if item["scenario"] == "uncontended_b"]
    a_base = [item["wall_to_workload_start_ms"] for item in recorded if item["scenario"] == "uncontended_a" and item["mode"] == "baseline"]
    b_base = [item["wall_to_workload_start_ms"] for item in recorded if item["scenario"] == "uncontended_b" and item["mode"] == "baseline"]
    paired_a = [candidate_v - baseline_v for candidate_v, baseline_v in zip(a_overheads, a_base)]
    paired_b = [candidate_v - baseline_v for candidate_v, baseline_v in zip(b_overheads, b_base)]
    contender_c = [item["a_wait_ms"] for item in candidate if item["scenario"] == "a_with_three_contenders"]
    contender_b = [item["a_wait_ms"] for item in recorded if item["scenario"] == "a_with_three_contenders" and item["mode"] == "baseline"]
    reduction = (1 - statistics.median(contender_c) / statistics.median(contender_b)) * 100
    verdicts = {
        "candidate_overlap_zero": sum(item["overlap_count"] for item in candidate) == 0,
        "candidate_digest_zero": all(item["contaminated_digest"] is None for item in candidate),
        "admission_during_a_zero": sum(item["non_a_admissions_during_a_intent"] for item in candidate) == 0,
        "forced_detect_at_least_5": count("forced_uncoordinated", "detected") >= 5,
        "unwrapped_detect_at_least_5": count("intentionally_unwrapped", "detected") >= 5,
        "fd_discrimination_6_of_6": count("direct_fd_closure_control") == 6,
        "all_rows_pass": all(item["pass"] for item in recorded),
        "crash_timeout_release_and_descendants": all(item["pass"] for item in recorded if item["scenario"] in {"kill_waiting_holding_each_lock", "timeout_term_resistant_descendant"}),
        "a_wait_bound": all(item.get("wait_bound_ok", True) for item in candidate),
        "all_contenders_within_four_batches": all(item["pass"] for item in candidate if item["scenario"] == "sustained_a_then_recovery"),
        "mixed_interoperability": all(item["pass"] for item in recorded if item["scenario"] == "mixed_c2_c3_c5_interoperability"),
        "contender_wait_reduction_at_least_50_percent": reduction >= 50,
        "paired_a_wall_overhead_p95_at_most_50ms": stats(paired_a)["p95"] <= 50,
        "paired_non_a_wall_overhead_p95_at_most_50ms": stats(paired_b)["p95"] <= 50,
        "topology_exact": all(item["pass"] for item in candidate if item["scenario"] == "actual_process_fd_topology"),
        "supervisor_death_custody_6_of_6": count("supervisor_death_custody") == 6,
        "known_bad_c4_rejected_6_of_6": count("supervisor_death_known_bad_c4") == 6,
        "watchdog_death_custody_6_of_6": count("watchdog_death_custody") == 6,
        "normal_group_quiescence_6_of_6": count("normal_completion_group_quiescence") == 6,
    }
    payload = {
        "schema": 1, "seed": SEED, "warmups": 1, "repetitions": REPETITIONS,
        "batch_seconds": BATCH_SECONDS, "literal_pass": all(verdicts.values()), "verdicts": verdicts,
        "metrics": {"paired_wall_overhead_a_ms": stats(paired_a), "paired_wall_overhead_non_a_ms": stats(paired_b),
                    "three_contender_a_wait_candidate_ms": stats(contender_c), "three_contender_a_wait_baseline_ms": stats(contender_b),
                    "three_contender_median_reduction_percent": reduction},
        "groups": numeric,
        "calibration": {"c2_functional_controls": "6/6 retained known-good",
                        "c2_known_bad_wall_overhead_ms": {"a": 60.815, "non_a": 62.241},
                        "c2_controls": "forced/unwrapped/inheritance discriminated 6/6",
                        "known_bad_c4_artifact_commit": C4_ARTIFACT_COMMIT,
                        "known_bad_c4_source_sha256": file_sha256(C4_SOURCE),
                        "known_bad_c4_binary_sha256": file_sha256(C4_WRAPPER)},
        "cost": {"wall_seconds": wall, "cpu_seconds": cpu, "spend_usd": 0, "egress_bytes": 0,
                 "artifact_bytes": 0, "compile_wall_seconds": compile_wall},
        "environment": {"platform": platform.platform(), "python": platform.python_version(),
                        "compiler": "cc (GCC) 15.2.1 20260123 (Red Hat 15.2.1-7)",
                        "compiler_package": "gcc-15.2.1-7.fc42.x86_64",
                        "compiler_license": "RPM License tag recorded in README; GCC runtime exception applies to generated code",
                        "libc": "glibc 2.41; glibc-2.41-18.fc42.x86_64; LGPL-2.1-or-later and package-listed components",
                        "kernel": "Linux 6.19.14-108.fc42.x86_64; kernel-core-6.19.14-108.fc42.x86_64",
                        "util_linux": "util-linux 2.40.4-10.fc42; package-listed GPL/LGPL/BSD licenses",
                        "build_command": BUILD_COMMAND,
                        "known_bad_c4_build_command": C4_BUILD_COMMAND,
                        "source_sha256": file_sha256(SOURCE), "binary_sha256": file_sha256(WRAPPER),
                        "linux_man_pages_archive_sha256": "a2c8a0c2efe8a978ce51ce800461eb9e8931f12cc7ba4b7faa3082b69ba7f12c",
                        "linux_man_pages_extract_sha256": "6b0903b7575c205ff0c910f5e2cefa178f9c453bd3cfc183aca511b966838536",
                        "util_linux_source_sha256": "d550bd2c9fb93f8d03c37bdfaa988820e8265d20ab64959307c3058165e37d13",
                        "flock": subprocess.check_output(["flock", "--version"], text=True).strip()},
    }
    for _ in range(5):
        rendered = json.dumps(payload, indent=2, sort_keys=True) + "\n"
        size = raw_path.stat().st_size + len(rendered.encode())
        if payload["cost"]["artifact_bytes"] == size: break
        payload["cost"]["artifact_bytes"] = size
    return payload


def run(output: Path, summary: Path) -> int:
    if output.exists() or summary.exists():
        raise RuntimeError("refusing to overwrite immutable result artifacts")
    output.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic(); usage_started = resource.getrusage(resource.RUSAGE_SELF); child_started = resource.getrusage(resource.RUSAGE_CHILDREN)
    compile_started = time.monotonic()
    subprocess.run(BUILD_COMMAND, check=True)
    actual_c4 = subprocess.check_output(
        ["git", "-C", str(C4_WORKTREE), "rev-parse", "HEAD"], text=True).strip()
    if actual_c4 != C4_ARTIFACT_COMMIT:
        raise RuntimeError(f"known-bad C4 drifted: {actual_c4}")
    subprocess.run(C4_BUILD_COMMAND, check=True)
    compile_wall = time.monotonic() - compile_started
    runtime = Path(tempfile.mkdtemp(prefix="aletheia-c5-canary."))
    h = Harness(runtime); rng = random.Random(SEED); rows: list[dict[str, Any]] = []
    try:
        def record(item: dict[str, Any], phase: str, repetition: int) -> None:
            item.update({"phase": phase, "repetition": repetition, "seed": SEED})
            rows.append(item)
            with output.open("a", encoding="utf-8") as stream: stream.write(json.dumps(item, sort_keys=True, separators=(",", ":")) + "\n")
        for repetition in range(REPETITIONS + 1):
            phase = "warmup" if repetition == 0 else "recorded"
            a_first = bool(rng.getrandbits(1))
            mode_order = ["baseline", "candidate"] if rng.getrandbits(1) else ["candidate", "baseline"]
            for scenario in (admitted, contenders):
                for mode in mode_order: record(scenario(h, mode), phase, repetition)
            for mode in mode_order: record(simultaneous(h, mode, a_first), phase, repetition)
            for scenario in (recovery, kill_matrix, timeout_descendant):
                for mode in mode_order: record(scenario(h, mode), phase, repetition)
            # Paired baseline/candidate order is seeded and retained; summary pairs by repetition.
            for role in ("A", "B"):
                for mode in mode_order: record(uncontended(h, mode, role), phase, repetition)
            record(mixed(h, C2_WRAPPER, C3_WRAPPER, "c2-a_vs_c3-non-a", True), phase, repetition)
            record(mixed(h, C3_WRAPPER, C2_WRAPPER, "c3-a_vs_c2-non-a", False), phase, repetition)
            record(mixed(h, C2_WRAPPER, WRAPPER, "c2-a_vs_c5-non-a", True), phase, repetition)
            record(mixed(h, WRAPPER, C2_WRAPPER, "c5-a_vs_c2-non-a", False), phase, repetition)
            record(mixed(h, C3_WRAPPER, WRAPPER, "c3-a_vs_c5-non-a", True), phase, repetition)
            record(mixed(h, WRAPPER, C3_WRAPPER, "c5-a_vs_c3-non-a", False), phase, repetition)
            record(invalid_paths(h), phase, repetition)
            record(contamination_control(h, "forced_uncoordinated"), phase, repetition)
            record(contamination_control(h, "intentionally_unwrapped"), phase, repetition)
            record(fd_control(h), phase, repetition)
            record(topology(h), phase, repetition)
            record(crash_custody(h, "supervisor"), phase, repetition)
            record(crash_custody(h, "supervisor", C4_WRAPPER, known_bad=True), phase, repetition)
            record(crash_custody(h, "watchdog"), phase, repetition)
            record(normal_group_quiescence(h), phase, repetition)
        self_usage = resource.getrusage(resource.RUSAGE_SELF); child_usage = resource.getrusage(resource.RUSAGE_CHILDREN)
        cpu = (self_usage.ru_utime - usage_started.ru_utime + self_usage.ru_stime - usage_started.ru_stime +
               child_usage.ru_utime - child_started.ru_utime + child_usage.ru_stime - child_started.ru_stime)
        payload = summarize(rows, time.monotonic() - started, cpu, compile_wall, output, summary)
        summary.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return 0 if payload["literal_pass"] else 1
    finally:
        # Roll back only this run. Stable lock files themselves were never unlinked by the candidate.
        if h.locks.exists() and not (probe(h.locks / "intent") and probe(h.locks / "host")):
            raise RuntimeError(f"rollback refused: C5 locks remain held at {h.locks}")
        shutil.rmtree(runtime)


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("command", choices=["run"])
    parser.add_argument("--output", type=Path, default=ROOT / "results/raw.jsonl")
    parser.add_argument("--summary", type=Path, default=ROOT / "results/summary.json")
    arguments = parser.parse_args(); return run(arguments.output, arguments.summary)


if __name__ == "__main__": raise SystemExit(main())
