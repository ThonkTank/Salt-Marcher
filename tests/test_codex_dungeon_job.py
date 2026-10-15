"""Resource admission regressions; no real services or large allocations."""
import contextlib
import importlib.util
import io
import multiprocessing
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "tools/codex-dungeon-job.py"
spec = importlib.util.spec_from_file_location("dungeon_job", SOURCE)
job = importlib.util.module_from_spec(spec)
spec.loader.exec_module(job)
G = job.GIB


def pending_launcher(root, role, start, release, results):
    """Keep an admitted unit pending, before it has any cgroup memory counters."""
    real_path = Path

    def mapped_path(value):
        if str(value) == "/sys/fs/cgroup":
            return real_path(root) / "cgroup"
        if str(value) == "/proc/meminfo":
            return real_path(root) / "meminfo"
        return real_path(value)

    mapped_path.cwd = real_path.cwd

    def run(argv, **kwargs):
        return subprocess.CompletedProcess(argv, 0, stdout="/fixture/codex-dungeon-jobs.slice\n")

    class Pending:
        def __init__(self, argv):
            results.put((role, "started"))

        def wait(self, timeout=None):
            if not release.wait(8):
                raise RuntimeError("test release timeout")
            return 0

        def poll(self):
            return 0 if release.is_set() else None

    with patch.object(job, "Path", mapped_path), \
         patch.dict(os.environ, {"XDG_RUNTIME_DIR": root}), \
         patch.object(job.sys, "argv", [str(SOURCE), role, "--", "fixture-command"]), \
         patch.object(job.subprocess, "run", run), \
         patch.object(job.subprocess, "Popen", Pending), \
         contextlib.redirect_stderr(io.StringIO()):
        start.wait(5)
        code = job.main()
        results.put((role, code))


class AdmissionTests(unittest.TestCase):
    def test_empty_slice_with_old_file_charge_can_start(self):
        allowed, growth = job.admission(14 * G, 14 * G, 22 * G, {"qa": 0})
        self.assertTrue(allowed)
        self.assertEqual(growth, 4 * G)

    def test_host_reserve_boundary(self):
        self.assertFalse(job.admission(12 * G - 1, 0, 22 * G, {"qa": 0})[0])
        self.assertTrue(job.admission(12 * G, 0, 22 * G, {"qa": 0})[0])

    def test_old_charge_still_consumes_slice_capacity(self):
        self.assertFalse(job.admission(100 * G, 19 * G, 22 * G, {"qa": 0})[0])

    def test_pending_jobs_reserve_their_full_future_growth(self):
        for n in (1, 2, 3):
            used = dict(zip(sorted(job.ROLES)[:n], [0] * n))
            self.assertEqual(job.admission(20 * G, 0, 22 * G, used), (True, n * 4 * G))
        self.assertFalse(job.admission(16 * G, 0, 22 * G,
                                       {"qa": 0, "planner": 0, "realist": 0})[0])

    def test_running_resident_memory_is_not_reserved_twice(self):
        self.assertEqual(job.admission(13 * G, 3 * G, 22 * G,
                                       {"qa": 0, "implementer": 3 * G}), (True, 5 * G))

    def test_invalid_measurements_fail_closed(self):
        for args in [(-1, 0, 22 * G, {"qa": 0}),
                     (20 * G, 0, 0, {"qa": 0}),
                     (20 * G, 0, 22 * G, {"qa": -1}),
                     (20 * G, 0, 22 * G, {"qa": G}),
                     (20 * G, 0, 22 * G, dict.fromkeys(job.ROLES, 0))]:
            with self.assertRaises(ValueError):
                job.admission(*args)

    def test_live_memory_credits_anon_and_shmem_but_not_file_cache(self):
        with tempfile.TemporaryDirectory() as d:
            group = Path(d)
            unit = group / "codex-dungeon-qa-one.service"
            unit.mkdir()
            (unit / "cgroup.events").write_text("populated 1\n")
            (unit / "memory.stat").write_text(f"anon {G}\nshmem {G}\nfile {8 * G}\n")
            self.assertEqual(job.job_memory(group, {"qa", "planner"}, "planner"), {"qa": 2 * G, "planner": 0})
            (unit / "cgroup.events").write_text("populated 0\n")
            self.assertEqual(job.job_memory(group, {"qa"}, "qa"), {"qa": 0})

    def test_unlocked_live_job_or_missing_counter_is_not_ignored(self):
        with tempfile.TemporaryDirectory() as d:
            unit = Path(d) / "codex-dungeon-qa-one.service"
            unit.mkdir()
            (unit / "cgroup.events").write_text("populated 1\n")
            (unit / "memory.stat").write_text("anon 1\nshmem 1\n")
            with self.assertRaises(ValueError):
                job.job_memory(Path(d), {"planner"}, "planner")
            with self.assertRaises(ValueError):
                job.job_memory(Path(d), {"qa"}, "qa")
            (unit / "memory.stat").write_text("anon 1\n")
            with self.assertRaises(KeyError):
                job.job_memory(Path(d), {"qa", "planner"}, "planner")

    def test_role_lock_is_exclusive(self):
        with tempfile.TemporaryDirectory() as d:
            held = job.lock_file(Path(d) / "role-qa.lock")
            try:
                self.assertIsNone(job.lock_file(Path(d) / "role-qa.lock"))
                self.assertEqual(job.occupied_roles(Path(d), "planner"), {"qa", "planner"})
            finally:
                held.close()

    def test_three_slot_limit(self):
        with tempfile.TemporaryDirectory() as d:
            locks = Path(d) / "codex-dungeon-job-locks"
            locks.mkdir()
            held = [job.lock_file(locks / f"slot-{n}.lock") for n in range(3)]
            try:
                with patch.dict(os.environ, {"XDG_RUNTIME_DIR": d}), \
                     patch.object(job.sys, "argv", [str(SOURCE), "qa", "--", "fixture-command"]), \
                     patch.object(job.signal, "signal"), \
                     patch.object(job.subprocess, "Popen") as launch, \
                     contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(job.main(), 75)
                    launch.assert_not_called()
            finally:
                for handle in held:
                    handle.close()

    def launch_case(self, available, concurrent, expected_starts):
        ctx = multiprocessing.get_context("fork")
        with tempfile.TemporaryDirectory() as d:
            group = Path(d) / "cgroup/fixture/codex-dungeon-jobs.slice"
            group.mkdir(parents=True)
            (group / "memory.current").write_text("0")
            (group / "memory.max").write_text(str(22 * G))
            (Path(d) / "meminfo").write_text(f"MemAvailable: {available * 1024 * 1024} kB\n")
            start, release, results = ctx.Event(), ctx.Event(), ctx.Queue()
            processes, outcomes = [], []
            try:
                for role in ("qa", "planner", "realist"):
                    p = ctx.Process(target=pending_launcher, args=(d, role, start, release, results))
                    processes.append(p)
                    p.start()
                    if not concurrent:
                        start.set()
                        outcomes.append(results.get(timeout=5))
                start.set()
                while len(outcomes) < 3:
                    outcomes.append(results.get(timeout=5))
                self.assertEqual(sum(value == "started" for _, value in outcomes), expected_starts)
                self.assertTrue(all(value in ("started", 75) for _, value in outcomes))
            finally:
                release.set()
                for p in processes:
                    p.join(5)
                    if p.is_alive():
                        p.terminate()
                        p.join(2)
                    self.assertEqual(p.exitcode, 0)

    def test_pending_startups_cannot_spend_same_headroom(self):
        self.launch_case(16, concurrent=False, expected_starts=2)

    def test_three_pending_jobs_start_when_capacity_fits(self):
        self.launch_case(20, concurrent=False, expected_starts=3)

    def test_simultaneous_starts_cannot_spend_same_headroom(self):
        self.launch_case(12, concurrent=True, expected_starts=1)

    def test_simultaneous_starts_all_proceed_when_capacity_fits(self):
        self.launch_case(20, concurrent=True, expected_starts=3)

    def test_admission_lock_wait_has_a_deadline(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "admission.lock"
            held = job.lock_file(path)
            try:
                started = time.monotonic()
                self.assertIsNone(job.lock_file(path, wait=0.03))
                self.assertGreaterEqual(time.monotonic() - started, 0.025)
                self.assertLess(time.monotonic() - started, 1)
            finally:
                held.close()

    def test_ending_job_is_measured_again_without_starting_a_command(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "memory.current").write_text("0")
            (root / "memory.max").write_text(str(22 * G))
            mem = root / "meminfo"
            mem.write_text(f"MemAvailable: {14 * 1024 * 1024} kB\n")
            with patch.object(job, "job_memory", side_effect=[{"qa": 0, "planner": G}, {"qa": 0}]) as measure, \
                 patch.object(job, "Path", return_value=mem), \
                 patch.object(job.subprocess, "Popen") as launch:
                self.assertEqual(job.memory_admission(root, root, "qa"), (True, 4 * G))
                self.assertEqual(measure.call_count, 2)
                launch.assert_not_called()

    def test_systemd_timeout_does_not_start_a_command(self):
        with tempfile.TemporaryDirectory() as d:
            with patch.dict(os.environ, {"XDG_RUNTIME_DIR": d}), \
                 patch.object(job.sys, "argv", [str(SOURCE), "qa", "--", "fixture-command"]), \
                 patch.object(job.signal, "signal"), \
                 patch.object(job.subprocess, "run", side_effect=subprocess.TimeoutExpired("systemctl", 2)) as run, \
                 patch.object(job.subprocess, "Popen") as launch, \
                 contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(job.main(), 78)
                self.assertEqual(run.call_args.kwargs["timeout"], 2)
                launch.assert_not_called()

    def test_interrupted_cleanup_timeout_names_own_unit_and_releases_locks(self):
        class Interrupted:
            ended = False

            def __init__(self, argv):
                self.unit = next(arg.split("=", 1)[1] for arg in argv if arg.startswith("--unit="))

            def wait(self, timeout=None):
                if not self.ended:
                    raise KeyboardInterrupt()
                return 0

            def poll(self):
                return 0 if self.ended else None

            def terminate(self):
                self.ended = True

        stopped = []

        def run(argv, **kwargs):
            if "stop" in argv:
                stopped.append(argv[-1])
                self.assertEqual(kwargs["timeout"], 12)
                raise subprocess.TimeoutExpired("systemctl stop", 12)
            return subprocess.CompletedProcess(argv, 0, stdout="/fixture/codex-dungeon-jobs.slice\n")

        with tempfile.TemporaryDirectory() as d:
            output = io.StringIO()
            with patch.dict(os.environ, {"XDG_RUNTIME_DIR": d}), \
                 patch.object(job.sys, "argv", [str(SOURCE), "qa", "--", "fixture-command"]), \
                 patch.object(job.signal, "signal"), \
                 patch.object(job, "memory_admission", return_value=(True, 4 * G)), \
                 patch.object(job.subprocess, "run", run), \
                 patch.object(job.subprocess, "Popen", Interrupted), \
                 contextlib.redirect_stderr(output):
                self.assertEqual(job.main(), 78)
            self.assertEqual(len(stopped), 1)
            self.assertIn(stopped[0], output.getvalue())
            self.assertTrue(stopped[0].startswith("codex-dungeon-qa-"))
            handle = job.lock_file(Path(d) / "codex-dungeon-job-locks/role-qa.lock")
            self.assertIsNotNone(handle)
            handle.close()

    def test_measurement_error_starts_nothing_and_releases_reservation(self):
        with tempfile.TemporaryDirectory() as d:
            with patch.dict(os.environ, {"XDG_RUNTIME_DIR": d}), \
                 patch.object(job.sys, "argv", [str(SOURCE), "qa", "--", "fixture-command"]), \
                 patch.object(job.signal, "signal"), \
                 patch.object(job.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout="/fixture/codex-dungeon-jobs.slice\n")), \
                 patch.object(job, "job_memory", side_effect=KeyError("anon")), \
                 patch.object(job.subprocess, "Popen") as launch, \
                 contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(job.main(), 78)
                launch.assert_not_called()
            for name in ["admission.lock", "role-qa.lock", "slot-0.lock"]:
                handle = job.lock_file(Path(d) / "codex-dungeon-job-locks" / name)
                self.assertIsNotNone(handle)
                handle.close()


if __name__ == "__main__":
    unittest.main()
