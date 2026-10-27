#!/usr/bin/env python3
"""Own native UI children, including Electron's detached process sessions."""
import os
import json
from pathlib import Path
import tempfile
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

# Sessions register exact success paths here, including custom result names.
# This registry belongs to one wrapper invocation and is removed on exit.
registry = tempfile.TemporaryDirectory(prefix='saltmarcher-ui-evidence-')
os.environ['CODEX_UI_EVIDENCE_REGISTRY'] = registry.name
child = None
code = 1
cleaning = False
interruption_requested = False

def interrupted(signum, frame):
    global interruption_requested, code
    if interruption_requested:
        return
    interruption_requested = True
    if cleaning:
        code = 130
        return
    raise KeyboardInterrupt

signal.signal(signal.SIGINT, interrupted)
signal.signal(signal.SIGTERM, interrupted)
try:
    child = subprocess.Popen([sys.executable, __file__, '--child', *sys.argv[1:]])
    code = child.wait()
except KeyboardInterrupt:
    code = 130
finally:
    cleaning = True
    if child is not None:
        leaked = list(owned_processes(child.pid))
        if leaked and code == 0:
            code = 1
            print('Native wrapper found surviving owned processes: '+str(leaked), file=sys.stderr)
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
        remaining = list(owned_processes(child.pid))
        if remaining:
            code = 1
            print('Native cleanup incomplete: '+str(remaining), file=sys.stderr)
    if code != 0:
        files = set()
        for record in Path(registry.name).glob('*.json'):
            try:
                value = json.loads(record.read_text())
                files.add(Path(value['file']))
            except (OSError, ValueError, KeyError, TypeError):
                pass
        for variable in ('QA_EVIDENCE_DIR', 'GM_QA_OUT'):
            if os.environ.get(variable):
                files.add(Path(os.environ[variable]).resolve() / 'result.json')
        for result in files:
            try:
                result.unlink(missing_ok=True)
                result.parent.mkdir(parents=True, exist_ok=True)
                (result.parent / 'wrapper-failure.json').write_text(json.dumps({
                    'exitCode': code,
                    'invalidatedSuccess': str(result),
                    'leakedOwnedPids': leaked if child is not None else [],
                    'remainingOwnedPids': remaining if child is not None else [],
                }, indent=2))
            except OSError as error:
                print('Cannot invalidate native success '+str(result)+': '+str(error), file=sys.stderr)
    registry.cleanup()
sys.exit(code)
