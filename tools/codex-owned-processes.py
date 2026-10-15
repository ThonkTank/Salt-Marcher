#!/usr/bin/python3
"""Own a disposable process group for UI cleanup; no budgets or scheduling."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import uuid


def main():
    if len(sys.argv) < 3 or sys.argv[1] != '--':
        print('Usage: codex-owned-processes -- COMMAND [ARGS...]', file=sys.stderr)
        return 64
    unit = f'codex-owned-{uuid.uuid4().hex}.service'
    argv = ['systemd-run', '--user', '--wait', '--pipe', '--collect', '--quiet',
            '--expand-environment=no', f'--unit={unit}', f'--working-directory={Path.cwd()}',
            '--property=KillMode=control-group', '--property=Delegate=yes',
            '--property=OOMPolicy=continue', '--property=OOMScoreAdjust=1000']
    for name in ('PATH', 'DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY', 'XDG_RUNTIME_DIR',
                 'DBUS_SESSION_BUS_ADDRESS', 'LANG', 'LC_ALL', 'SSH_AUTH_SOCK', 'NODE_OPTIONS'):
        if name in os.environ:
            argv.append(f'--setenv={name}={os.environ[name]}')
    argv += ['--', *sys.argv[2:]]
    process = None

    def interrupted(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        process = subprocess.Popen(argv)
        return process.wait()
    except KeyboardInterrupt:
        return 130
    finally:
        if process is not None and process.poll() is None:
            # Only this invocation's unique unit, including surviving children.
            subprocess.run(['systemctl', '--user', 'stop', unit], check=True, timeout=15)
            process.wait(timeout=5)


if __name__ == '__main__':
    sys.exit(main())
