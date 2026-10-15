#!/usr/bin/python3
"""Run one agent's build/test/GUI process tree within the shared machine budget."""
import fcntl
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import uuid

ROLES = {"implementer", "planner", "realist", "qa"}
SLICE = "codex-dungeon-jobs.slice"
GIB = 1024 ** 3
BUSY = 75
JOB_LIMIT = 4 * GIB
RESERVE = 8 * GIB


def lock_file(path, wait=0):
    handle = path.open("a+")
    deadline = time.monotonic() + wait
    try:
        while True:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return handle
            except BlockingIOError:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    handle.close()
                    return None
                time.sleep(min(0.05, remaining))
    except BaseException:
        handle.close()
        raise


def occupied_roles(locks, own_role):
    """Existing role locks also cover jobs whose systemd unit is not created yet."""
    occupied = {own_role}
    for role in ROLES - {own_role}:
        probe = lock_file(locks / f"role-{role}.lock")
        if probe is None:
            occupied.add(role)
        else:
            probe.close()
    return occupied


def job_memory(group_path, occupied, starting_role):
    """Credit only resident anon/shmem in live units, never reclaimable file cache."""
    used = {role: 0 for role in occupied}
    for role in ROLES:
        live = []
        live_names = []
        for unit_path in group_path.glob(f"codex-dungeon-{role}-*.service"):
            try:
                events = dict(line.split() for line in (unit_path / "cgroup.events").read_text().splitlines())
                if events["populated"] not in ("0", "1"):
                    raise ValueError("invalid cgroup population counter")
                if events["populated"] == "0":
                    continue
                stats = dict(line.split() for line in (unit_path / "memory.stat").read_text().splitlines())
                anon, shmem = int(stats["anon"]), int(stats["shmem"])
                if min(anon, shmem) < 0:
                    raise ValueError("negative job memory counter")
                live.append(min(JOB_LIMIT, anon + shmem))
                live_names.append(unit_path.name)
            except FileNotFoundError:
                if unit_path.exists():
                    raise
                # The job ended during the snapshot; reserve its full budget.
                continue
        if len(live) > 1 or (live and (role not in occupied or role == starting_role)):
            raise ValueError(f"role {role}: live units {live_names} disagree with role ownership")
        if live:
            used[role] = live[0]
    return used


def admission(available, group_usage, group_limit, used):
    """Reserve remaining job growth, plus host headroom, from one sampled snapshot."""
    if min(available, group_usage, group_limit) < 0 or group_limit == 0:
        raise ValueError("invalid memory budget")
    if not 1 <= len(used) <= 3 or any(not 0 <= value <= JOB_LIMIT for value in used.values()):
        raise ValueError("invalid occupied job budgets")
    if sum(used.values()) > group_usage:
        raise ValueError("job memory exceeds slice accounting")
    growth = sum(JOB_LIMIT - value for value in used.values())
    return available >= RESERVE + growth and group_usage + growth <= group_limit, growth


def memory_admission(group_path, locks, role):
    # Jobs may finish between counter reads. Repeat measurements once, never a start.
    for attempt in range(2):
        try:
            used = job_memory(group_path, occupied_roles(locks, role), role)
            usage = int((group_path / "memory.current").read_text())
            limit = int((group_path / "memory.max").read_text())
            available = next(int(line.split()[1]) * 1024 for line in Path("/proc/meminfo").read_text().splitlines()
                             if line.startswith("MemAvailable:"))
            return admission(available, usage, limit, used)
        except (OSError, ValueError, KeyError, StopIteration):
            if attempt:
                raise


def main():
    if len(sys.argv) < 4 or sys.argv[1] not in ROLES or sys.argv[2] != "--":
        print("Usage: codex-dungeon-job {implementer|planner|realist|qa} -- COMMAND [ARGS...]", file=sys.stderr)
        return 64
    role = sys.argv[1]
    runtime = Path(os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}"))
    locks = runtime / "codex-dungeon-job-locks"
    locks.mkdir(mode=0o700, exist_ok=True)
    handles = []
    process = None
    unit = f"codex-dungeon-{role}-{uuid.uuid4().hex}.service"

    def interrupted(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        gate = lock_file(locks / "admission.lock", wait=5)
        if gate is None:
            print("BUSY: another job is being admitted; continue lightweight work.", file=sys.stderr)
            return BUSY
        handles.append(gate)
        role_lock = lock_file(locks / f"role-{role}.lock")
        if role_lock is None:
            print(f"BUSY: {role} already has a heavy job; continue lightweight work.", file=sys.stderr)
            return BUSY
        handles.append(role_lock)
        for index in range(3):
            slot = lock_file(locks / f"slot-{index}.lock")
            if slot is not None:
                handles.append(slot)
                break
        else:
            print("BUSY: all three heavy-job slots occupied; continue lightweight work.", file=sys.stderr)
            return BUSY

        subprocess.run(["systemctl", "--user", "start", SLICE], check=True, timeout=2)
        group = subprocess.run(["systemctl", "--user", "show", SLICE,
                                "--property=ControlGroup", "--value"],
                               check=True, text=True, capture_output=True, timeout=2).stdout.strip()
        if not group.startswith("/") or not group.endswith("/" + SLICE):
            raise ValueError("unexpected resource cgroup")
        group_path = Path("/sys/fs/cgroup") / group.lstrip("/")
        admitted, growth = memory_admission(group_path, locks, role)
        if not admitted:
            print(f"BUSY: remaining job growth {growth / GIB:.2f} GiB does not fit "
                  "host reserve or slice capacity; continue lightweight work.", file=sys.stderr)
            return BUSY

        arguments = ["systemd-run", "--user", "--wait", "--pipe", "--collect", "--quiet",
                     "--expand-environment=no",
                     f"--unit={unit}", f"--slice={SLICE}", f"--working-directory={Path.cwd()}",
                     "--property=MemoryHigh=3G", f"--property=MemoryMax={JOB_LIMIT}",
                     "--property=MemorySwapMax=0", "--property=CPUQuota=150%",
                     "--property=TasksMax=256", "--property=OOMPolicy=kill",
                     "--property=KillMode=control-group", "--property=Delegate=yes", "--property=LimitCORE=0", "--property=TimeoutStopSec=10s",
                     "--property=RuntimeMaxSec=20min", "--property=Nice=5"]
        for name in ["PATH", "DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY", "XDG_RUNTIME_DIR",
                     "DBUS_SESSION_BUS_ADDRESS", "LANG", "LC_ALL", "SSH_AUTH_SOCK"]:
            if name in os.environ:
                arguments.append(f"--setenv={name}={os.environ[name]}")
        arguments += ["--setenv=NODE_OPTIONS=--max-old-space-size=2048",
                      "--setenv=npm_config_jobs=2", "--setenv=UV_THREADPOOL_SIZE=2", "--setenv=GOMAXPROCS=2", "--setenv=CMAKE_BUILD_PARALLEL_LEVEL=2",
                      "--setenv=MAKEFLAGS=-j2", "--", *sys.argv[3:]]
        print(f"Dungeon job: {unit}; max 4 GiB RAM, 150% CPU, no swap.", file=sys.stderr)
        process = subprocess.Popen(arguments)
        # The held role/slot locks reserve a pending unit's full budget. No registry.
        handles.remove(gate)
        gate.close()
        exit_code = process.wait()
    except KeyboardInterrupt:
        exit_code = 130
    except (OSError, ValueError, KeyError, StopIteration, subprocess.SubprocessError) as error:
        phase = "job not started" if process is None else f"job state uncertain for {unit}"
        print(f"Resource guard unavailable; {phase}: {error}", file=sys.stderr)
        exit_code = 78
    finally:
        cleanup_failed = False
        try:
            if process is not None and process.poll() is None:
                try:
                    subprocess.run(["systemctl", "--user", "stop", unit], check=True, timeout=12,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except (OSError, subprocess.SubprocessError) as error:
                    print(f"Own unit cleanup unconfirmed: {unit}: {error}", file=sys.stderr)
                    cleanup_failed = True
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=2)
        finally:
            for handle in reversed(handles):
                handle.close()
    return 78 if cleanup_failed else exit_code



if __name__ == "__main__":
    sys.exit(main())
