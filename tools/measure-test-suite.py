#!/usr/bin/env python3
"""Measure the unchanged npm test command, including preparation, on Linux.

GNU time records process-tree resource usage. One-second /proc samples describe
host pressure and observed child processes; short-lived children can be missed,
so sampled per-file durations/CPU are lower bounds, not exact totals.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path, help='New evidence directory, normally under .build/')
parser.add_argument('selection', nargs=argparse.REMAINDER, help='Optional -- followed by normal npm test arguments')
args = parser.parse_args()
selection = args.selection[1:] if args.selection[:1] == ['--'] else args.selection
command = ['npm', 'test'] + (['--', *selection] if selection else [])
def source_state():
    names = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--',
        'src', 'desktop', 'tests', 'tools', 'build.mjs', 'package.json', 'package-lock.json', 'tsconfig*.json']).decode().split('\0')
    files = {name: hashlib.sha256(Path(name).read_bytes()).hexdigest() for name in sorted(set(names)) if name and Path(name).is_file()}
    return {'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
        'dirty': subprocess.check_output(['git', 'status', '--porcelain'], text=True),
        'digest': hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest(), 'files': files}
source_before = source_state()
cache_before = sorted(str(p.relative_to('.build/test-assets')) for p in Path('.build/test-assets').glob('*/*/manifest.json'))
output = args.output
output.mkdir(parents=True, exist_ok=False)
started_at = time.time()
started = time.monotonic()
samples = []
processes = {}
metadata = {
    'startedAt': started_at,
    'platform': os.uname()._asdict() if hasattr(os.uname(), '_asdict') else list(os.uname()),
    'cpuInfo': Path('/proc/cpuinfo').read_text(),
    'affinity': sorted(os.sched_getaffinity(0)),
    'command': command,
    'node': subprocess.check_output(['node', '--version'], text=True).strip(),
    'sourceBefore': source_before,
    'cacheBefore': cache_before,
    'samplingSeconds': 1,
    'sampledProcessValuesAreLowerBounds': True,
}
with (output / 'suite.log').open('w') as log:
    child = subprocess.Popen(
        ['/usr/bin/time', '-v', '-o', str(output / 'time.txt'), *command],
        stdout=log, stderr=subprocess.STDOUT,
    )
    while child.poll() is None:
        now = time.monotonic() - started
        samples.append({
            's': now,
            'cpu': Path('/proc/stat').read_text().splitlines()[0],
            'load': Path('/proc/loadavg').read_text().strip(),
            'memory': Path('/proc/meminfo').read_text(),
            'pressure': {key: Path('/proc/pressure', key).read_text()
                         for key in ['cpu', 'io', 'memory']},
        })
        for file in Path('/proc').glob('[0-9]*/stat'):
            try:
                raw = file.read_text()
                fields = raw[raw.rindex(')') + 2:].split()
                pid, parent = int(file.parent.name), int(fields[1])
                if parent != child.pid and parent not in processes and pid not in processes:
                    continue
                command = (file.parent / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
                entry = processes.setdefault(pid, {
                    'pid': pid, 'parent': parent, 'cmd': command, 'first': now,
                })
                entry.update(last=now, userTicks=int(fields[11]), systemTicks=int(fields[12]),
                             rssPages=int(fields[21]), io=(file.parent / 'io').read_text())
            except (OSError, ValueError, IndexError):
                pass  # A child may exit between reading stat and io.
        time.sleep(1)
    result = {
        **metadata, 'code': child.returncode,
        'wallSeconds': time.monotonic() - started,
        'ticksPerSecond': os.sysconf('SC_CLK_TCK'),
        'processes': list(processes.values()), 'samples': samples,
        'sourceAfter': source_state(),
    }
    result['sourcesUnchanged'] = result['sourceBefore']['digest'] == result['sourceAfter']['digest']
    (output / 'host.json').write_text(json.dumps(result, indent=2) + '\n')
    for name in ['test-run.json', 'tests.tap']:
        source = Path('.build', name)
        if source.exists() and source.stat().st_mtime >= started_at:
            shutil.copy2(source, output / name)
    print(json.dumps({key: result[key] for key in ['code', 'wallSeconds', 'ticksPerSecond']}))
raise SystemExit(child.returncode)
