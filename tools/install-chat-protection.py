#!/usr/bin/python3
"""Install/verify/roll back only the root-owned ChatGPT protection service."""
import argparse
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import time

SERVICE = '''[Unit]
Description=OOM protection for ChatGPT and chat controllers (UID %i)
After=systemd-oomd.service

[Service]
ExecStart=/usr/bin/python3 -B /usr/local/lib/codex-chat-protection/chat-protection.py --uid %i
Restart=on-failure
RestartSec=1
OOMScoreAdjust=-1000
OOMPolicy=continue
ManagedOOMPreference=omit
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=-/run/user/%i
StateDirectory=codex-chat-protection
StateDirectoryMode=0700
RuntimeDirectory=codex-chat-protection
RuntimeDirectoryMode=0755
RestrictAddressFamilies=AF_UNIX
PrivateTmp=yes
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
'''


def command(*args):
    subprocess.run(args, check=True)


def verify(uid):
    path = Path(f'/run/codex-chat-protection/{uid}-status.json')
    state = json.loads(path.read_text())
    assert time.time()-state['updated'] < 3, 'Protection status stale'
    assert state['protected'] and not state['errors'], state
    for p in state['protected']:
        proc = Path('/proc')/str(p['pid'])
        try:
            start = proc.joinpath('stat').read_text().rsplit(') ', 1)[1].split()[19]
            if start != p['start']:
                continue
            assert proc.joinpath('oom_score_adj').read_text().strip() == '-1000', p
        except FileNotFoundError:
            pass
    print(json.dumps(state, indent=2))
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['install', 'verify', 'uninstall', 'oom-test'])
    parser.add_argument('--uid', type=int, required=True)
    args = parser.parse_args()
    if os.geteuid() != 0 or args.uid <= 0:
        parser.error('Requires root and non-root target UID')
    pwd.getpwuid(args.uid)
    root = Path('/usr/local/lib/codex-chat-protection')
    unitfile = Path('/etc/systemd/system/codex-chat-protection@.service')
    unit = f'codex-chat-protection@{args.uid}.service'
    if args.action == 'install':
        if unitfile.exists() or root.exists():
            parser.error('Existing installation: verify or uninstall first; no overwrite')
        source = Path(__file__).resolve().parent
        root.mkdir(mode=0o755)
        for name in ('chat-protection.py', 'test-chat-protection-oom.py'):
            destination = root/name
            shutil.copyfile(source/name, destination)
            destination.chmod(0o644)
            os.chown(destination, 0, 0)
        unitfile.write_text(SERVICE)
        unitfile.chmod(0o644)
        os.chown(unitfile, 0, 0)
        command('/usr/bin/systemctl', 'daemon-reload')
        command('/usr/bin/systemctl', 'enable', '--now', unit)
        for attempt in range(40):
            try:
                verify(args.uid)
                command('/usr/bin/python3', '-B', str(root/'test-chat-protection-oom.py'))
                Path(f'/run/codex-chat-protection/{args.uid}-accepted.json').write_text(json.dumps(dict(
                    uid=args.uid, accepted=time.time(), isolated_oom_test=True,
                    boot_id=Path('/proc/sys/kernel/random/boot_id').read_text().strip()))+'\n')
                break
            except (OSError, ValueError, AssertionError):
                time.sleep(.25)
        else:
            raise RuntimeError('Protection not verified. Old resource guard must remain; inspect service logs.')
    elif args.action == 'verify':
        verify(args.uid)
    elif args.action == 'oom-test':
        verify(args.uid)
        command('/usr/bin/python3', '-B', str(root/'test-chat-protection-oom.py'))
    else:
        command('/usr/bin/systemctl', 'disable', '--now', unit)
        command('/usr/bin/python3', '-B', str(root/'chat-protection.py'), '--uid', str(args.uid), '--restore')
        unitfile.unlink()
        shutil.rmtree(root)
        command('/usr/bin/systemctl', 'daemon-reload')
        print('Protection removed; original scores and unit policies restored. Restore old workload limits separately if desired.')


if __name__ == '__main__':
    main()
