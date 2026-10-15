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
JOB_LIMIT = 4 * GIB


def lock_file(path):
    handle = path.open("a+")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return handle
    except BlockingIOError:
        handle.close()
        return None
    except BaseException:
        handle.close()
        raise


def main():
    if len(sys.argv) < 4 or sys.argv[1] not in ROLES or sys.argv[2] != "--":
        print("Usage: codex-dungeon-job {implementer|planner|realist|qa} -- COMMAND [ARGS...]", file=sys.stderr)
        return 64
    role = sys.argv[1]
    runtime = Path(os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}"))
    locks = runtime / "codex-dungeon-job-locks"
    locks.mkdir(mode=0o700, exist_ok=True)
    role_lock = None
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
        # A killed launcher can leave its systemd service alive. Its role remains busy.
        existing = subprocess.run(
            ["systemctl", "--user", "list-units", f"codex-dungeon-{role}-*.service",
             "--state=activating,active,deactivating", "--no-legend", "--plain", "--no-pager"],
            check=True, text=True, capture_output=True, timeout=2)
        if existing.stdout.strip():
            print(f"BUSY: {role} still has a live service; inspect that job.", file=sys.stderr)
            return BUSY

        subprocess.run(["systemctl", "--user", "start", SLICE], check=True, timeout=2)

        arguments = ["systemd-run", "--user", "--wait", "--pipe", "--collect", "--quiet",
                     "--expand-environment=no",
                     f"--unit={unit}", f"--slice={SLICE}", f"--working-directory={Path.cwd()}",
                     "--property=MemoryHigh=3G", f"--property=MemoryMax={JOB_LIMIT}",
                     "--property=MemorySwapMax=0",
                     "--property=TasksMax=256", "--property=OOMPolicy=kill",
                     "--property=KillMode=control-group", "--property=Delegate=yes", "--property=LimitCORE=0", "--property=TimeoutStopSec=10s",
                     "--property=RuntimeMaxSec=20min", "--property=Nice=5"]
        for name in ["PATH", "DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY", "XDG_RUNTIME_DIR",
                     "DBUS_SESSION_BUS_ADDRESS", "LANG", "LC_ALL", "SSH_AUTH_SOCK"]:
            if name in os.environ:
                arguments.append(f"--setenv={name}={os.environ[name]}")
        arguments += ["--setenv=NODE_OPTIONS=--max-old-space-size=2048", "--", *sys.argv[3:]]
        print(f"Dungeon job: {unit}; max 4 GiB RAM, no swap; CPU shared by priority.", file=sys.stderr)
        process = subprocess.Popen(arguments)
        exit_code = process.wait()
    except KeyboardInterrupt:
        exit_code = 130
    except (OSError, ValueError, subprocess.SubprocessError) as error:
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
            if role_lock is not None:
                role_lock.close()
    return 78 if cleanup_failed else exit_code



if __name__ == "__main__":
    sys.exit(main())
