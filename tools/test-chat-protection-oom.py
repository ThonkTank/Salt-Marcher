#!/usr/bin/python3
"""Root-only acceptance test in a disposable 96 MiB cgroup, never host-wide."""
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid


if os.geteuid() != 0:
    sys.exit('Requires root')
if '--inside' in sys.argv:
    Path('/proc/self/oom_score_adj').write_text('-1000')
    worker = subprocess.Popen([sys.executable, '-c', '''
from pathlib import Path
Path('/proc/self/oom_score_adj').write_text('1000')
chunks=[]
while True:
    chunks.append(bytearray(4*1024*1024))
'''])
    code = worker.wait(timeout=15)
    group = Path('/proc/self/cgroup').read_text().strip().split('::')[1]
    events = (Path('/sys/fs/cgroup'+group)/'memory.events').read_text()
    assert code == -9 and int(dict(line.split() for line in events.splitlines())['oom_kill']) >= 1
    assert Path('/proc/self/oom_score_adj').read_text().strip() == '-1000'
    result = dict(worker_exit=code, protected_parent_survived=True, memory_events=events,
                  cgroup=group, memory_max=96*1024*1024)
    print(json.dumps(result), flush=True)
else:
    unit = 'codex-chat-protection-test-'+uuid.uuid4().hex
    result = subprocess.run(['/usr/bin/systemd-run', '--wait', '--pipe', '--collect', '--quiet',
        '--unit='+unit, '-p', 'MemoryMax=96M', '-p', 'MemorySwapMax=0',
        '-p', 'OOMPolicy=continue', '-p', 'KillMode=control-group', '-p', 'RuntimeMaxSec=25s',
        '-p', 'ManagedOOMPreference=omit', '--', sys.executable, str(Path(__file__).resolve()), '--inside'],
        capture_output=True, text=True, timeout=35)
    print(result.stdout, end='')
    if result.returncode:
        print(result.stderr, file=sys.stderr)
    sys.exit(result.returncode)
