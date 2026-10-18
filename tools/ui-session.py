#!/usr/bin/env python3
"""Own native UI children, including Electron's detached process sessions."""
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

def owned_processes(group):
    marker = f'CODEX_OWNED_UI_SESSION={group}'.encode()
    for entry in os.scandir('/proc'):
        if not entry.name.isdigit():
            continue
        try:
            with open(entry.path+'/stat') as stream:
                stat=stream.read().rsplit(') ',1)[1].split()
            if stat[0]=='Z':
                continue
            # Playwright/Electron can setsid() again. Its inherited session
            # marker remains ours even when the original process group ends.
            if int(stat[2])==group:
                yield int(entry.name)
                continue
            with open(entry.path+'/environ','rb') as stream:
                if marker in stream.read().split(b'\0'):
                    yield int(entry.name)
        except (OSError,ValueError,IndexError):
            pass

def signal_owned(group, signum):
    for pid in owned_processes(group):
        try:
            os.kill(pid, signum)
        except ProcessLookupError:
            pass

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
        signal_owned(child.pid, signal.SIGTERM)
        try:
            child.wait(timeout=3)
        except subprocess.TimeoutExpired:
            signal_owned(child.pid, signal.SIGKILL)
            child.wait()
        deadline=time.monotonic()+3
        while any(owned_processes(child.pid)) and time.monotonic()<deadline:
            time.sleep(.05)
        signal_owned(child.pid, signal.SIGKILL)
        deadline=time.monotonic()+1
        while any(owned_processes(child.pid)) and time.monotonic()<deadline:
            time.sleep(.02)
sys.exit(code)
