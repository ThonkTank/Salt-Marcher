#!/usr/bin/env python3
"""Own a native UI process group when the user service manager cannot dispatch."""
import os
import signal
import subprocess
import sys
import time

if sys.argv[1:2] == ['--child']:
    os.setsid()
    os.environ['CODEX_OWNED_UI_SESSION'] = str(os.getpid())
    with open('/proc/self/oom_score_adj', 'w') as stream:
        stream.write('1000')
    os.execvp(sys.argv[2], sys.argv[2:])

def live_group(group):
    for entry in os.scandir('/proc'):
        if not entry.name.isdigit():
            continue
        try:
            with open(entry.path+'/stat') as stream:
                stat=stream.read().split(') ',1)[1].split()
            if int(stat[2])==group and stat[0]!='Z':
                return True
        except (OSError,ValueError,IndexError):
            pass
    return False

child = None

def interrupted(signum, frame):
    raise KeyboardInterrupt

signal.signal(signal.SIGINT, interrupted)
signal.signal(signal.SIGTERM, interrupted)
try:
    child = subprocess.Popen([sys.executable, __file__, '--child', *sys.argv[1:]])
    code = child.wait()
except KeyboardInterrupt:
    code = 130
finally:
    if child is not None:
        # This session's original group cannot be reused while members remain.
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            child.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
        deadline=time.monotonic()+3
        while live_group(child.pid) and time.monotonic()<deadline:
            time.sleep(.05)
        if live_group(child.pid):
            os.killpg(child.pid, signal.SIGKILL)
sys.exit(code)
