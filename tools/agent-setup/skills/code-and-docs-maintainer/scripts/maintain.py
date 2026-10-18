#!/usr/bin/env python3
"""Small local maintenance checkpoint, Git inventory and content-free character count."""

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tempfile


MODES = ('current', 'prune', 'find-code', 'read-code', 'bridge', 'entrypoints')
CODE = {'.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.sh', '.css', '.html', '.sql'}
DOCS = {'.md', '.markdown', '.rst', '.adoc'}


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], stderr=subprocess.PIPE)


def revision(repo, value):
    return git(repo, 'rev-parse', '--verify', '--end-of-options', value + '^{commit}').decode().strip()


def safe_path(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or '..' in path.parts or str(path) != value or '\x00' in value:
        raise ValueError('Use a normalized repository-relative path')
    return value


def inventory(repo, sha):
    result = {}
    for record in git(repo, 'ls-tree', '-r', '-z', sha).split(b'\0'):
        if not record:
            continue
        metadata, raw_path = record.split(b'\t', 1)
        mode, kind, blob = metadata.decode().split()
        path = raw_path.decode('utf-8')
        suffix = PurePosixPath(path).suffix.lower()
        category = 'docs' if suffix in DOCS else 'code' if suffix in CODE else 'reference'
        if mode not in ('100644', '100755') or kind != 'blob':
            category = 'reference'
        result[path] = {'blob': blob, 'kind': category, 'mode': mode}
    return result


def text_at(repo, sha, path):
    return git(repo, 'show', f'{sha}:{safe_path(path)}').decode('utf-8')


def write_state(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False) as stream:
            temporary = stream.name
            json.dump(state, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def load_state(path, repo):
    state = json.loads(path.read_text(encoding='utf-8'))
    if state.get('version') != 1 or state.get('repository') != str(repo):
        raise ValueError('Checkpoint version/repository mismatch; do not replace another role state')
    if state.get('mode') not in MODES:
        raise ValueError('Unknown maintenance mode')
    return state


def clean(repo, paths=()):
    args = ['status', '--porcelain', '--untracked-files=normal']
    if paths:
        args += ['--', *paths]
    if git(repo, *args).strip():
        raise ValueError('Uncommitted work remains; preserve it and finish checks/publication first')


def progress(state, entries):
    mode = state['mode']
    category = 'code' if mode in ('find-code', 'read-code') else 'docs'
    reviews = state['reviews'].get(mode, {})
    candidates = [(p, row) for p, row in sorted(entries.items()) if row['kind'] == category]
    pending = [(p, row) for p, row in candidates
               if reviews.get(p, {}).get('blob') != row['blob'] or not reviews.get(p, {}).get('done')]
    return candidates, pending


def count_side(repo, sha, specs, searches):
    intervals = {}
    entries = inventory(repo, sha)
    for spec in specs:
        match = re.fullmatch(r'(.+)#L([1-9][0-9]*)-L([1-9][0-9]*)', spec)
        path = safe_path(match[1] if match else spec)
        if path not in entries or entries[path]['mode'] not in ('100644', '100755'):
            raise ValueError('Count only tracked text/code files: ' + path)
        lines = text_at(repo, sha, path).splitlines(keepends=True)
        start, end = (int(match[2]), int(match[3])) if match else (1, len(lines))
        if match and (end < start or end > len(lines)):
            raise ValueError('Line range outside file: ' + spec)
        intervals.setdefault(path, set()).update(range(start - 1, end))
    total = 0
    for path, indices in intervals.items():
        lines = text_at(repo, sha, path).splitlines(keepends=True)
        total += sum(len(lines[index]) for index in indices)
    for path in dict.fromkeys(searches):
        with Path(path).open(encoding='utf-8', newline='') as stream:
            total += len(stream.read())
    return total


def run(args):
    repo = Path(git(Path(args.repo), 'rev-parse', '--show-toplevel').decode().strip()).resolve()
    if args.command == 'count':
        sha = revision(repo, args.rev)
        doc = count_side(repo, sha, args.doc, args.doc_search)
        code = count_side(repo, sha, args.code, args.code_search)
        return {'revision': sha, 'documentation_characters': doc, 'code_characters': code,
                'documentation_not_longer': doc <= code}

    if not args.state:
        raise ValueError('--state must name the existing role checkpoint outside the repository')
    path = Path(args.state).expanduser().resolve()
    if path.is_relative_to(repo):
        raise ValueError('Keep local checkpoints outside the product working copy')
    if args.command == 'init':
        if path.exists():
            raise ValueError('Checkpoint exists; resume it instead of resetting progress')
        state = {'version': 1, 'repository': str(repo), 'mode': MODES[0], 'active': None,
                 'progress_base': revision(repo, 'HEAD'),
                 'blocked': [], 'reviews': {}, 'chat_marks': {}, 'last_completed': None}
        write_state(path, state)
        return {'checkpoint': str(path), 'mode': state['mode']}

    state = load_state(path, repo)
    sha = revision(repo, 'HEAD')
    entries = inventory(repo, sha)
    candidates, pending = progress(state, entries)
    command = args.command
    if command == 'status':
        return {'mode': state['mode'], 'active': state['active'], 'blocked': state['blocked'],
                'progress_base': state['progress_base'],
                'last_completed': state['last_completed'], 'chat_marks': state['chat_marks'],
                'inventory': {'revision': sha, 'files': len(entries), 'eligible': len(candidates),
                              'pending': len(pending), 'reference_files': sum(
                                  row['kind'] == 'reference' for row in entries.values())}}
    if command == 'next':
        parked = {p for task in state['blocked'] for p in task['paths']}
        rows = []
        for file, row in pending:
            if file in parked or (args.prefix and not any(
                    file == prefix or file.startswith(prefix.rstrip('/') + '/') for prefix in args.prefix)):
                continue
            prior = state['reviews'].get(state['mode'], {}).get(file, {})
            start = prior.get('through', 0) + 1 if prior.get('blob') == row['blob'] else 1
            text = text_at(repo, sha, file)
            rows.append({'path': file, **row, 'characters': len(text),
                         'lines': len(text.splitlines()), 'next_line': start})
            if len(rows) == args.limit:
                break
        return {'mode': state['mode'], 'pending': len(pending), 'files': rows,
                'blocked': len(state['blocked'])}

    active = state['active']
    if command == 'start':
        if active:
            raise ValueError('Resume the active task before starting another')
        paths = [safe_path(p) for p in args.paths]
        if any(p not in entries for p in paths):
            raise ValueError('Task paths must exist at the recorded basis')
        state['active'] = {'mode': state['mode'], 'goal': args.goal, 'basis': sha,
                           'paths': paths, 'phase': 'work', 'next': 'Complete the selected task'}
    elif command == 'checkpoint':
        if not active:
            raise ValueError('No active task')
        active.update(phase=args.phase, next=args.next)
    elif command == 'chat-mark':
        state['chat_marks'][args.thread] = args.item
    elif command == 'progress':
        if state['mode'] != 'current':
            raise ValueError('Advance the progress baseline only in the current-statements mode')
        target = revision(repo, args.through)
        for older, newer in ((state['progress_base'], target), (target, sha)):
            subprocess.run(['git', '-C', str(repo), 'merge-base', '--is-ancestor', older, newer],
                           check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        state['progress_base'] = target
    elif command == 'mark':
        file = safe_path(args.path)
        clean(repo, [file])
        exists = file in entries
        if not exists:
            if args.decision != 'remove' or not active or file not in active['paths']:
                raise ValueError('Removed path needs its original active task basis')
            if file not in inventory(repo, active['basis']):
                raise ValueError('Removed path was not present at the basis')
        if exists and args.decision == 'remove':
            raise ValueError('Path still exists')
        through = args.through
        if through is not None:
            lines = len(text_at(repo, sha, file).splitlines()) if exists else 0
            if not 0 < through < lines:
                raise ValueError('Partial progress must precede the actual end; omit --through when complete')
            prior = state['reviews'].get(state['mode'], {}).get(file, {})
            if prior.get('blob') == entries[file]['blob'] and through <= prior.get('through', 0):
                raise ValueError('Partial progress must move forward')
        state['reviews'].setdefault(state['mode'], {})[file] = {
            'blob': entries[file]['blob'] if exists else None, 'done': through is None,
            'through': through or 0, 'decision': args.decision, 'reason': args.reason, 'revision': sha}
    elif command == 'forget':
        file = safe_path(args.path)
        state['reviews'].get(state['mode'], {}).pop(file, None)
    elif command == 'park':
        if not active:
            raise ValueError('No active task')
        active['blocker'] = args.reason
        state['blocked'].append(active)
        state['active'] = None
    elif command == 'resume':
        if active:
            raise ValueError('Another task remains active')
        task = state['blocked'][args.index]
        if task['mode'] != state['mode']:
            raise ValueError('Resume in the matching mode of the fixed cycle')
        state['active'] = state['blocked'].pop(args.index)
        state['active'].pop('blocker', None)
    elif command == 'finish':
        clean(repo)
        if args.outcome == 'complete':
            if not active or not args.published:
                raise ValueError('Completion needs an active task and its published commit')
            published = revision(repo, args.published)
            if published != sha:
                raise ValueError('Publish and verify the current HEAD before completing this task')
            integrated = revision(repo, args.integrated_ref)
            subprocess.run(['git', '-C', str(repo), 'merge-base', '--is-ancestor', published, integrated],
                           check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        elif active and (active['phase'] != 'work' or active['basis'] != sha):
            raise ValueError('Do not skip committed work or an active check/publication as no-work')
        state['last_completed'] = {'mode': state['mode'], 'outcome': args.outcome,
                                   'evidence': args.evidence, 'revision': sha,
                                   'published': args.published}
        state['active'] = None
        state['mode'] = MODES[(MODES.index(state['mode']) + 1) % len(MODES)]
    write_state(path, state)
    return {'mode': state['mode'], 'active': state['active'], 'checkpoint': str(path)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='.')
    parser.add_argument('--state')
    subs = parser.add_subparsers(dest='command', required=True)
    for name in ('init', 'status'):
        subs.add_parser(name)
    choice = subs.add_parser('next')
    choice.add_argument('--limit', type=int, default=5)
    choice.add_argument('--prefix', action='append', default=[])
    start = subs.add_parser('start')
    start.add_argument('--goal', required=True)
    start.add_argument('--paths', nargs='+', required=True)
    step = subs.add_parser('checkpoint')
    step.add_argument('--phase', choices=('work', 'check', 'publish'), required=True)
    step.add_argument('--next', required=True)
    mark = subs.add_parser('mark')
    mark.add_argument('--path', required=True)
    mark.add_argument('--decision', choices=('keep', 'improve', 'merge', 'remove', 'preserve'), required=True)
    mark.add_argument('--reason', required=True)
    mark.add_argument('--through', type=int)
    forget = subs.add_parser('forget')
    forget.add_argument('--path', required=True)
    park = subs.add_parser('park')
    park.add_argument('--reason', required=True)
    resume = subs.add_parser('resume')
    resume.add_argument('--index', type=int, required=True)
    chat = subs.add_parser('chat-mark')
    chat.add_argument('--thread', required=True)
    chat.add_argument('--item', required=True)
    baseline = subs.add_parser('progress')
    baseline.add_argument('--through', required=True)
    finish = subs.add_parser('finish')
    finish.add_argument('--outcome', choices=('complete', 'no-work'), required=True)
    finish.add_argument('--published')
    finish.add_argument('--integrated-ref', default='origin/main')
    finish.add_argument('--evidence', required=True)
    count = subs.add_parser('count')
    count.add_argument('--rev', required=True)
    count.add_argument('--doc', action='append', required=True)
    count.add_argument('--code', action='append', required=True)
    count.add_argument('--doc-search', action='append', default=[])
    count.add_argument('--code-search', action='append', default=[])
    args = parser.parse_args()
    try:
        for field in ('goal', 'reason', 'evidence', 'next', 'thread', 'item'):
            if hasattr(args, field) and not getattr(args, field).strip():
                raise ValueError('--' + field + ' must explain a concrete task or decision')
        if args.command == 'next' and not 1 <= args.limit <= 50:
            raise ValueError('--limit must be between 1 and 50')
        if args.command == 'resume' and args.index < 0:
            raise ValueError('Use a nonnegative blocked-task index')
        print(json.dumps(run(args), ensure_ascii=False))
    except (OSError, ValueError, KeyError, IndexError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Maintenance checkpoint unchanged: {error}\n')


if __name__ == '__main__':
    main()
