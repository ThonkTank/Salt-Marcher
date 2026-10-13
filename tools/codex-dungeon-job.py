#!/usr/bin/python3
"""Run one agent's build/test/GUI process tree within the shared machine budget."""
import fcntl
import os
from pathlib import Path
import signal
import subprocess
import sys
import uuid

ROLES = {"implementer", "planner", "realist", "qa"}
SLICE = "codex-dungeon-jobs.slice"
GIB = 1024 ** 3
BUSY = 75


def lock_file(path):
    handle = path.open("a+")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        return None
    return handle


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

        subprocess.run(["systemctl", "--user", "start", SLICE], check=True)
        group = subprocess.run(["systemctl", "--user", "show", SLICE,
                                "--property=ControlGroup", "--value"],
                               check=True, text=True, capture_output=True).stdout.strip()
        group_usage = int((Path("/sys/fs/cgroup") / group.lstrip("/") / "memory.current").read_text())
        available = next(int(line.split()[1]) * 1024 for line in Path("/proc/meminfo").read_text().splitlines()
                         if line.startswith("MemAvailable:"))
        # Reserve eight GiB outside this slice even if its full twelve GiB fills.
        if available + group_usage < 20 * GIB:
            print("BUSY: insufficient RAM for the shared 12 GiB budget plus 8 GiB reserve; continue lightweight work.", file=sys.stderr)
            return BUSY

        arguments = ["systemd-run", "--user", "--wait", "--pipe", "--collect", "--quiet",
                     "--expand-environment=no",
                     f"--unit={unit}", f"--slice={SLICE}", f"--working-directory={Path.cwd()}",
                     "--property=MemoryHigh=3G", "--property=MemoryMax=4G",
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
        return process.wait()
    except KeyboardInterrupt:
        return 130
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Resource guard unavailable; job not started: {error}", file=sys.stderr)
        return 78
    finally:
        if process is not None:
            subprocess.run(["systemctl", "--user", "stop", unit],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        for handle in reversed(handles):
            handle.close()


if __name__ == "__main__":
    sys.exit(main())
