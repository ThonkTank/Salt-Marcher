"""Launcher behavior without real services or large memory allocations."""
import contextlib
import importlib.util
import io
import multiprocessing
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'tools/codex-dungeon-job.py'
spec = importlib.util.spec_from_file_location('dungeon_job', SOURCE)
job = importlib.util.module_from_spec(spec)
spec.loader.exec_module(job)


def idle_systemctl(argv, **kwargs):
    return subprocess.CompletedProcess(argv, 0, stdout='')


def held_job(root, role, ready, release, outcomes):
    class Running:
        def __init__(self, argv):
            outcomes.put((role, 'running'))
            ready.set()

        def wait(self, timeout=None):
            if not release.wait(10):
                raise RuntimeError('fixture release timed out')
            return 0

        def poll(self):
            return 0 if release.is_set() else None

    with patch.dict(os.environ, {'XDG_RUNTIME_DIR': root}), \
         patch.object(job.sys, 'argv', [str(SOURCE), role, '--', 'fixture']), \
         patch.object(job.subprocess, 'run', idle_systemctl), \
         patch.object(job.subprocess, 'Popen', Running), \
         contextlib.redirect_stderr(io.StringIO()):
        outcomes.put((role, job.main()))
        ready.set()


class LauncherTests(unittest.TestCase):
    def invoke(self, root, role='qa', command=None):
        with patch.dict(os.environ, {'XDG_RUNTIME_DIR': root}), \
             patch.object(job.sys, 'argv', [str(SOURCE), role, '--', *(command or ['fixture'])]), \
             patch.object(job.signal, 'signal'), \
             contextlib.redirect_stderr(io.StringIO()):
            return job.main()

    def test_all_four_roles_run_together_and_same_role_cannot_start_twice(self):
        ctx = multiprocessing.get_context('fork')
        with tempfile.TemporaryDirectory() as root:
            release, outcomes = ctx.Event(), ctx.Queue()
            children = []
            try:
                for role in sorted(job.ROLES):
                    ready = ctx.Event()
                    child = ctx.Process(target=held_job, args=(root, role, ready, release, outcomes))
                    children.append(child)
                    child.start()
                    self.assertTrue(ready.wait(5), role)
                    self.assertEqual(outcomes.get(timeout=2), (role, 'running'))
                with patch.object(job.subprocess, 'Popen') as launch:
                    self.assertEqual(self.invoke(root), 75)
                    launch.assert_not_called()
            finally:
                release.set()
                for child in children:
                    child.join(5)
                    if child.is_alive():
                        child.terminate()
                        child.join(2)
                    self.assertEqual(child.exitcode, 0)
            self.assertEqual({outcomes.get(timeout=2) for _ in children}, {(r, 0) for r in job.ROLES})
            with patch.object(job.subprocess, 'run', idle_systemctl), \
                 patch.object(job.subprocess, 'Popen') as launch:
                launch.return_value.wait.return_value = 0
                launch.return_value.poll.return_value = 0
                self.assertEqual(self.invoke(root), 0)

    def test_arguments_environment_limits_and_exit_code_survive(self):
        command = ['printf', '%s', 'a b', '$(touch never)', '`literal`', '--flag=two words']
        with tempfile.TemporaryDirectory() as root, \
             patch.dict(os.environ, {'PATH': '/fixture/bin', 'DISPLAY': ':99'}), \
             patch.object(job.subprocess, 'run', idle_systemctl), \
             patch.object(job.subprocess, 'Popen') as launch:
            launch.return_value.wait.return_value = 23
            launch.return_value.poll.return_value = 23
            self.assertEqual(self.invoke(root, command=command), 23)
            argv = launch.call_args.args[0]
            self.assertEqual(argv[-len(command):], command)
            for value in ['MemoryHigh=3G', 'MemoryMax=4294967296', 'MemorySwapMax=0',
                          'TasksMax=256', 'KillMode=control-group', 'RuntimeMaxSec=20min', 'Nice=5']:
                self.assertIn('--property=' + value, argv)
            self.assertIn('--working-directory=' + str(Path.cwd()), argv)
            self.assertIn('--setenv=DISPLAY=:99', argv)
            self.assertIn('--setenv=PATH=/fixture/bin', argv)
            self.assertIn('--setenv=NODE_OPTIONS=--max-old-space-size=2048', argv)
            self.assertFalse(any('CPUQuota=' in arg for arg in argv))
            forced = ('npm_config_jobs=', 'UV_THREADPOOL_SIZE=', 'GOMAXPROCS=', 'CMAKE_BUILD_PARALLEL_LEVEL=', 'MAKEFLAGS=')
            self.assertFalse(any(any(key in arg for key in forced) for arg in argv))
            self.assertNotIn('shell', launch.call_args.kwargs)

    def test_orphan_service_blocks_only_its_own_role(self):
        def existing(argv, **kwargs):
            text = 'codex-dungeon-qa-orphan.service loaded active running fixture' if 'codex-dungeon-qa-*.service' in argv else ''
            return subprocess.CompletedProcess(argv, 0, stdout=text)
        with tempfile.TemporaryDirectory() as root, \
             patch.object(job.subprocess, 'run', side_effect=existing), \
             patch.object(job.subprocess, 'Popen') as launch:
            self.assertEqual(self.invoke(root), 75)
            launch.assert_not_called()
            launch.return_value.wait.return_value = 0
            launch.return_value.poll.return_value = 0
            self.assertEqual(self.invoke(root, role='planner'), 0)

    def test_systemd_failure_starts_nothing_and_releases_role(self):
        with tempfile.TemporaryDirectory() as root:
            for failure in [subprocess.TimeoutExpired('systemctl', 2), OSError('bus unavailable')]:
                with patch.object(job.subprocess, 'run', side_effect=failure), \
                     patch.object(job.subprocess, 'Popen') as launch:
                    self.assertEqual(self.invoke(root), 78)
                    launch.assert_not_called()
                handle = job.lock_file(Path(root) / 'codex-dungeon-job-locks/role-qa.lock')
                self.assertIsNotNone(handle)
                handle.close()

    def test_interruption_stops_only_own_service_before_releasing_role(self):
        with tempfile.TemporaryDirectory() as root:
            stopped = []

            def run(argv, **kwargs):
                if 'stop' in argv:
                    handle = job.lock_file(Path(root) / 'codex-dungeon-job-locks/role-qa.lock')
                    self.assertIsNone(handle)
                    stopped.append(argv[-1])
                return idle_systemctl(argv)

            with patch.object(job.subprocess, 'run', side_effect=run), \
                 patch.object(job.subprocess, 'Popen') as launch:
                process = launch.return_value
                process.wait.side_effect = [KeyboardInterrupt(), 0]
                process.poll.return_value = None
                self.assertEqual(self.invoke(root), 130)
                unit = next(arg.split('=', 1)[1] for arg in launch.call_args.args[0] if arg.startswith('--unit='))
                self.assertEqual(stopped, [unit])
                self.assertTrue(unit.startswith('codex-dungeon-qa-'))
                self.assertEqual(process.terminate.call_count, 1)
            handle = job.lock_file(Path(root) / 'codex-dungeon-job-locks/role-qa.lock')
            self.assertIsNotNone(handle)
            handle.close()

    def test_failed_cleanup_reports_failure_and_live_service_blocks_next_start(self):
        with tempfile.TemporaryDirectory() as root:
            def failed_stop(argv, **kwargs):
                if 'stop' in argv:
                    raise subprocess.TimeoutExpired('stop', 12)
                return idle_systemctl(argv)
            with patch.object(job.subprocess, 'run', side_effect=failed_stop), \
                 patch.object(job.subprocess, 'Popen') as launch:
                launch.return_value.wait.side_effect = [KeyboardInterrupt(), 0]
                launch.return_value.poll.return_value = None
                self.assertEqual(self.invoke(root), 78)
            with patch.object(job.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout='qa still running')), \
                 patch.object(job.subprocess, 'Popen') as launch:
                self.assertEqual(self.invoke(root), 75)
                launch.assert_not_called()

    def test_invalid_role_does_not_start_anything(self):
        with tempfile.TemporaryDirectory() as root, patch.object(job.subprocess, 'Popen') as launch:
            self.assertEqual(self.invoke(root, role='unknown'), 64)
            launch.assert_not_called()


if __name__ == '__main__':
    unittest.main()
