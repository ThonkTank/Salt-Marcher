"""Exercise real Git snapshots and durable CLI behavior; no model calls."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


HELPER = Path(__file__).resolve().parents[1] / 'skills/code-and-docs-maintainer/scripts/maintain.py'


class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        self.state = self.root / 'role.json'
        self.git('init', '-q')
        for path, text in {'README.md': 'Einstieg ä\nZweite Zeile\nDritte\n',
                           'docs/unlinked.md': 'Unverlinkt, aber vollständig erfasst.\n',
                           'src/item.ts': 'const secret = "SOURCE_CONTENT_MUST_NOT_LEAK";\nexport { secret };\n',
                           'catalog.json': '{"original":true}\n'}.items():
            self.write(path, text)
        self.commit()
        self.cli('init')

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], stderr=subprocess.PIPE).decode().strip()

    def write(self, path, text):
        file = self.repo / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text, encoding='utf-8')

    def commit(self):
        self.git('add', '.')
        self.git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                 'commit', '-qm', 'fixture')
        return self.git('rev-parse', 'HEAD')

    def cli(self, *args, fail=False):
        result = subprocess.run([sys.executable, '-B', str(HELPER), '--repo', str(self.repo),
                                 '--state', str(self.state), *args], capture_output=True, text=True)
        if fail:
            self.assertNotEqual(result.returncode, 0)
            return result
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_inventory_includes_unlinked_and_resumes_partial_work(self):
        rows = self.cli('next')['files']
        self.assertEqual({x['path'] for x in rows}, {'README.md', 'docs/unlinked.md'})
        self.cli('mark', '--path', 'README.md', '--through', '1', '--decision', 'keep', '--reason', 'Start erklärt')
        self.assertEqual(self.cli('next')['files'][0]['next_line'], 2)
        self.cli('mark', '--path', 'README.md', '--decision', 'keep', '--reason', 'Vollständig sinnvoll')
        self.assertEqual(self.cli('next')['files'][0]['path'], 'docs/unlinked.md')
        self.write('README.md', 'Geänderter Einstieg\n')
        self.commit()
        self.assertEqual(self.cli('next')['files'][0]['next_line'], 1)

    def test_no_reset_of_existing_state_and_dirty_marks_are_rejected(self):
        original = self.state.read_bytes()
        self.cli('init', fail=True)
        self.assertEqual(self.state.read_bytes(), original)
        self.write('README.md', 'Ungeprüfter Entwurf\n')
        self.cli('mark', '--path', 'README.md', '--decision', 'keep', '--reason', 'X', fail=True)
        self.assertEqual(self.state.read_bytes(), original)

    def test_fixed_cycle_and_active_publication_resume(self):
        modes = ['current', 'prune', 'find-code', 'read-code', 'bridge', 'entrypoints']
        for mode in modes:
            self.assertEqual(self.cli('status')['mode'], mode)
            self.cli('finish', '--outcome', 'no-work', '--evidence', 'Kein belegter Bedarf')
        self.assertEqual(self.cli('status')['mode'], 'current')
        self.cli('start', '--goal', 'Einstieg verbessern', '--paths', 'README.md')
        self.cli('checkpoint', '--phase', 'publish', '--next', 'CI prüfen')
        self.assertEqual(self.cli('status')['active']['next'], 'CI prüfen')
        before = self.state.read_bytes()
        self.cli('start', '--goal', 'Nicht verdrängen', '--paths', 'README.md', fail=True)
        self.cli('finish', '--outcome', 'no-work', '--evidence', 'Überspringen', fail=True)
        self.cli('finish', '--outcome', 'complete', '--published', 'HEAD', '--evidence', 'X', fail=True)
        self.assertEqual(self.state.read_bytes(), before)
        self.cli('finish', '--outcome', 'complete', '--published', 'HEAD',
                 '--integrated-ref', 'HEAD', '--evidence', 'Passende Prüfung und Integration')
        self.assertEqual(self.cli('status')['mode'], 'prune')

    def test_unpublished_commit_cannot_be_reported_as_complete_or_no_work(self):
        baseline = self.git('rev-parse', 'HEAD')
        self.git('branch', 'integrated', baseline)
        self.cli('start', '--goal', 'Aktualisieren', '--paths', 'README.md')
        self.write('README.md', 'Neuer Inhalt\n')
        new = self.commit()
        before = self.state.read_bytes()
        self.cli('finish', '--outcome', 'complete', '--published', new,
                 '--integrated-ref', 'integrated', '--evidence', 'Nicht integriert', fail=True)
        self.cli('finish', '--outcome', 'complete', '--published', baseline,
                 '--integrated-ref', 'integrated', '--evidence', 'Alter Beleg', fail=True)
        self.cli('finish', '--outcome', 'no-work', '--evidence', 'Nicht nichts', fail=True)
        self.assertEqual(self.state.read_bytes(), before)

    def test_blocked_work_stays_visible_without_blocking_independent_selection(self):
        self.cli('start', '--goal', 'Offene Arbeit', '--paths', 'README.md')
        self.cli('park', '--reason', 'Externe Freigabe fehlt')
        self.assertEqual(len(self.cli('status')['blocked']), 1)
        self.assertNotIn('README.md', [x['path'] for x in self.cli('next')['files']])
        self.cli('resume', '--index', '0')
        self.assertEqual(self.cli('status')['active']['goal'], 'Offene Arbeit')

    def test_count_is_snapshot_based_unicode_and_does_not_emit_contents(self):
        sha = self.git('rev-parse', 'HEAD')
        expected = len('Einstieg ä\nZweite Zeile\n')
        self.write('README.md', 'Working tree must not affect snapshot measurement\n')
        measured = self.cli('count', '--rev', sha, '--doc', 'README.md#L1-L2',
                            '--doc', 'README.md#L2-L2', '--code', 'src/item.ts')
        self.assertEqual(measured['documentation_characters'], expected)
        self.assertEqual(measured['code_characters'], len((self.repo/'src/item.ts').read_text()))
        self.assertNotIn('SOURCE_CONTENT_MUST_NOT_LEAK', json.dumps(measured))
        self.cli('count', '--rev', sha, '--doc', 'README.md#L1-L100', '--code', 'src/item.ts', fail=True)
        self.cli('count', '--rev', sha, '--doc', '../README.md', '--code', 'src/item.ts', fail=True)
        self.cli('count', '--rev', sha, '--doc', 'catalog.json', '--code', 'src/item.ts')

    def test_search_output_counts_exact_characters_and_changed_relationship_can_reopen(self):
        search = self.root / 'existing-search.txt'
        search.write_bytes('Treffer ä\r\n'.encode())
        measured = self.cli('count', '--rev', 'HEAD', '--doc', 'README.md', '--code', 'src/item.ts',
                            '--doc-search', str(search))
        self.assertEqual(measured['documentation_characters'],
                         len((self.repo/'README.md').read_text()) + len('Treffer ä\r\n'))
        self.cli('mark', '--path', 'README.md', '--decision', 'keep', '--reason', 'Sinnvoll')
        self.cli('forget', '--path', 'README.md')
        self.assertEqual(self.cli('next')['files'][0]['path'], 'README.md')

    def test_removal_requires_a_real_task_basis(self):
        self.cli('mark', '--path', 'missing.md', '--decision', 'remove', '--reason', 'X', fail=True)
        self.cli('start', '--goal', 'Doppelung entfernen', '--paths', 'docs/unlinked.md')
        (self.repo/'docs/unlinked.md').unlink()
        self.commit()
        self.cli('mark', '--path', 'docs/unlinked.md', '--decision', 'remove', '--reason', 'Vollständig ersetzt')
        self.assertEqual(self.cli('status')['active']['goal'], 'Doppelung entfernen')

    def test_progress_baseline_is_explicit_and_never_runs_backwards(self):
        original = self.cli('status')['progress_base']
        self.write('README.md', 'Fortschritt\n')
        new = self.commit()
        self.assertEqual(self.cli('status')['progress_base'], original)
        self.cli('progress', '--through', new)
        before = self.state.read_bytes()
        self.cli('progress', '--through', original, fail=True)
        self.assertEqual(self.state.read_bytes(), before)
        self.cli('chat-mark', '--thread', 'project-thread', '--item', 'turn/item/offset')
        self.assertEqual(self.cli('status')['chat_marks'], {'project-thread': 'turn/item/offset'})


if __name__ == '__main__':
    unittest.main()
