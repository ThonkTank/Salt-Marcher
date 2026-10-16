#!/usr/bin/python3
"""Protect installed ChatGPT/control binaries; leave their work OOM-killable.

Root service, not an agent launcher. No memory budgets, admission locks or kills.
"""
import argparse
import json
import os
from pathlib import Path
import pwd
import subprocess
import time

APP = '/usr/lib/chatgpt/ChatGPT'
CONTROL = '/usr/lib/chatgpt/resources/codex'
DROPIN = '40-chat-protection.conf'
INTERVAL = .25


def is_control(exe, args, env, owner, mode):
    if owner != 0 or mode & 0o022:
        return False
    if exe == APP:
        return not any(value.startswith(b'ELECTRON_RUN_AS_NODE=') and
                       value.partition(b'=')[2] for value in env)
    if exe == CONTROL:
        options = iter(args)
        for arg in options:
            if arg in (b'-c', b'--config', b'-p', b'--profile', b'--enable', b'--disable'):
                next(options, None)
            elif not arg.startswith(b'-'):
                return arg in (b'app-server', b'exec-server')
    return False


def read_at(fd, name):
    child = os.open(name, os.O_RDONLY, dir_fd=fd)
    with os.fdopen(child, 'rb') as stream:
        return stream.read()


def inspect_process(pid, uid):
    """Use one proc directory handle, including writes, to avoid PID reuse."""
    fd = os.open(f'/proc/{pid}', os.O_RDONLY | os.O_DIRECTORY)
    try:
        if os.fstat(fd).st_uid != uid:
            return None
        stat = read_at(fd, 'stat').rsplit(b') ', 1)[1].split()
        if stat[0] == b'Z':
            return None
        exe = os.readlink('exe', dir_fd=fd).removesuffix(' (deleted)')
        critical = False
        if exe in (APP, CONTROL):
            binary = os.stat('exe', dir_fd=fd)
            args = read_at(fd, 'cmdline').split(b'\0')[1:]
            env = read_at(fd, 'environ').split(b'\0') if exe == APP else []
            critical = is_control(exe, args, env, binary.st_uid, binary.st_mode)
        group = next(line[3:] for line in read_at(fd, 'cgroup').decode().splitlines() if line.startswith('0::'))
        result = dict(pid=pid, start=stat[19].decode(), parent=int(stat[1]),
                      group=group, critical=critical, score=int(read_at(fd, 'oom_score_adj')))
        result['fd'] = fd
        fd = None
        return result
    finally:
        if fd is not None:
            os.close(fd)


def related_processes(processes, previous):
    groups = {p['group'] for p in processes.values() if p['critical']}
    related = {pid for pid, p in processes.items() if p['critical'] or
               previous.get(str(pid), {}).get('start') == p['start'] or
               any(p['group'] == g or p['group'].startswith(g + '/') for g in groups)}
    while True:
        descendants = {pid for pid, p in processes.items() if p['parent'] in related}
        if descendants <= related:
            return related
        related |= descendants


def unit_for(group, uid):
    prefix = f'/user.slice/user-{uid}.slice/user@{uid}.service/'
    if not group.startswith(prefix):
        raise ValueError(f'Unexpected app cgroup: {group}')
    # A delegated subgroup belongs to the nearest containing service/scope.
    return next(p for p in reversed(group[len(prefix):].split('/'))
                if p.endswith(('.service', '.scope')))


def userctl(uid, *args, **kwargs):
    return subprocess.run(['/usr/bin/runuser', '-u', pwd.getpwuid(uid).pw_name, '--',
                           '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin',
                           f'XDG_RUNTIME_DIR=/run/user/{uid}',
                           f'DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/{uid}/bus',
                           '/usr/bin/systemctl', '--user', *args],
                          check=True, text=True, capture_output=True, timeout=8, **kwargs)


def configure_unit(uid, unit):
    section = 'Scope' if unit.endswith('.scope') else 'Service'
    userctl(uid, 'edit', '--runtime', '--stdin', f'--drop-in={DROPIN}', unit,
            input=f'[{section}]\nOOMPolicy=continue\nManagedOOMPreference=omit\n')
    actual = userctl(uid, 'show', unit, '-p', 'OOMPolicy', '-p', 'ManagedOOMPreference').stdout
    if not {'OOMPolicy=continue', 'ManagedOOMPreference=omit'} <= set(actual.splitlines()):
        raise RuntimeError(f'Unit protection not effective: {unit}: {actual}')


def save(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)


def set_score(process, score):
    fd = os.open('oom_score_adj', os.O_WRONLY, dir_fd=process['fd'])
    with os.fdopen(fd, 'w') as stream:
        stream.write(str(score))


def run(uid, state):
    journal = state / f'{uid}-restore.json'
    saved = json.loads(journal.read_text()) if journal.exists() else dict(processes={}, units=[])
    configured = {}
    last_error = None
    while True:
        started = time.monotonic()
        processes = {}
        errors = []
        try:
            for entry in Path('/proc').iterdir():
                if not entry.name.isdecimal():
                    continue
                try:
                    p = inspect_process(int(entry.name), uid)
                    if p:
                        processes[p['pid']] = p
                except (FileNotFoundError, ProcessLookupError):
                    pass
                except (OSError, ValueError, StopIteration) as error:
                    # Disappearing/unreadable foreign processes are not protected.
                    try:
                        if entry.stat().st_uid == uid:
                            errors.append(f'{entry.name}: {error}')
                    except FileNotFoundError:
                        pass
            related = related_processes(processes, saved['processes'])
            units = {unit_for(p['group'], uid) for p in processes.values() if p['critical']}
            changed = False
            for pid in related:
                p = processes[pid]
                if saved['processes'].get(str(pid), {}).get('start') != p['start']:
                    saved['processes'][str(pid)] = dict(start=p['start'], score=p['score'])
                    changed = True
            for unit in sorted(units):
                if unit not in saved['units']:
                    saved['units'].append(unit)
                    changed = True
            # Save originals before any mutation, including across service restarts.
            alive = {str(pid) for pid in related}
            stale = set(saved['processes']) - alive
            for pid in stale:
                del saved['processes'][pid]
            if changed or stale:
                save(journal, saved)
            for pid in related:
                p = processes[pid]
                target = -1000 if p['critical'] else 1000
                if p['score'] != target:
                    try:
                        set_score(p, target)
                    except (FileNotFoundError, ProcessLookupError):
                        pass
                    except OSError as error:
                        errors.append(f'{pid}: {error}')
            for unit in sorted(units):
                if started - configured.get(unit, -100) >= 10:
                    try:
                        actual = userctl(uid, 'show', unit, '-p', 'OOMPolicy', '-p', 'ManagedOOMPreference').stdout
                        if not {'OOMPolicy=continue', 'ManagedOOMPreference=omit'} <= set(actual.splitlines()):
                            configure_unit(uid, unit)
                        configured[unit] = started
                    except (OSError, subprocess.SubprocessError, RuntimeError) as error:
                        errors.append(str(error))
            save(Path('/run/codex-chat-protection') / f'{uid}-status.json', dict(updated=time.time(), interval=INTERVAL,
                 scan_seconds=time.monotonic()-started,
                 protected=[dict(pid=p['pid'], start=p['start'], group=p['group'])
                            for p in processes.values() if p['critical']],
                 killable=len(related)-sum(p['critical'] for p in processes.values()),
                 units=sorted(units), errors=errors))
            error = '; '.join(errors) or None
            if error != last_error:
                print(error or 'Chat protection healthy', flush=True)
                last_error = error
        finally:
            for p in processes.values():
                os.close(p['fd'])
        time.sleep(max(0, INTERVAL-(time.monotonic()-started)))


def restore(uid, state):
    journal = state / f'{uid}-restore.json'
    if not journal.exists():
        return
    saved = json.loads(journal.read_text())
    for pid, original in saved['processes'].items():
        try:
            p = inspect_process(int(pid), uid)
            if p:
                try:
                    if p['start'] == original['start']:
                        set_score(p, original['score'])
                finally:
                    os.close(p['fd'])
        except (FileNotFoundError, ProcessLookupError):
            pass
    # Remove only our drop-ins, as the user (never follow user symlinks as root).
    paths = [f'/run/user/{uid}/systemd/user/{unit}.d/{DROPIN}' for unit in saved['units']]
    subprocess.run(['/usr/bin/runuser', '-u', pwd.getpwuid(uid).pw_name, '--',
                    '/usr/bin/rm', '-f', '--', *paths], check=True)
    userctl(uid, 'daemon-reload')
    journal.unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--uid', required=True, type=int)
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0 or args.uid <= 0:
        parser.error('Requires root and a non-root target UID')
    root = Path('/var/lib/codex-chat-protection')
    root.mkdir(mode=0o700, exist_ok=True)
    (restore if args.restore else run)(args.uid, root)
