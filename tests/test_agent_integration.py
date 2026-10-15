"""Exercise the shared Git workflow using local bare repositories only."""
from pathlib import Path
import subprocess
import tempfile
import unittest

DEFAULT = "active/installed-phase1"
DOCS = "docs/atlas-user-workflows"


def git(path, *args, check=True):
    return subprocess.run(["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@invalid",
                           "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null",
                           "-C", str(path), *args], capture_output=True, text=True, check=check)


class SharedIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.remote = self.root / "remote.git"
        self.remote.mkdir()
        git(self.remote, "init", "--bare", f"--initial-branch={DEFAULT}")
        seed = self.root / "seed"
        seed.mkdir()
        git(seed, "init", f"--initial-branch={DEFAULT}")
        (seed / "base.txt").write_text("baseline\n")
        git(seed, "add", "base.txt")
        git(seed, "commit", "-m", "baseline")
        git(seed, "remote", "add", "origin", str(self.remote))
        git(seed, "push", "origin", DEFAULT)
        git(seed, "branch", DOCS)
        git(seed, "push", "origin", DOCS)

    def worker(self, name):
        path = self.root / name
        git(self.root, "clone", "--single-branch", "--branch", DOCS, str(self.remote), str(path))
        self.assertNotEqual(git(path, "show-ref", "--verify", f"refs/remotes/origin/{DEFAULT}", check=False).returncode, 0)
        git(path, "config", "--add", "remote.origin.fetch", f"+refs/heads/{DEFAULT}:refs/remotes/origin/{DEFAULT}")
        git(path, "fetch", "origin")
        git(path, "switch", "-c", name)
        (path / f"{name}.txt").write_text(name + "\n")
        git(path, "add", f"{name}.txt")
        git(path, "commit", "-m", name)
        commit = git(path, "rev-parse", "HEAD").stdout.strip()
        git(path, "push", "--set-upstream", "origin", name)
        git(path, "config", "--add", "remote.origin.fetch", f"+refs/heads/{name}:refs/remotes/origin/{name}")
        git(path, "fetch", "origin")
        return path, commit

    def integration(self, worker):
        path = self.root / (worker.name + "-integration")
        git(worker, "worktree", "add", "--detach", str(path), f"origin/{DEFAULT}")
        git(path, "merge", "--no-edit", worker.name)
        return path

    def test_role_sync_is_not_shared_integration(self):
        worker, own = self.worker("qa")
        self.assertEqual(git(worker, "rev-parse", "HEAD").stdout, git(worker, "rev-parse", "@{upstream}").stdout)
        self.assertEqual(git(worker, "merge-base", "--is-ancestor", own, f"origin/{DEFAULT}", check=False).returncode, 1)
        integration = self.integration(worker)
        git(integration, "push", "origin", f"HEAD:refs/heads/{DEFAULT}")
        git(worker, "fetch", "origin")
        self.assertEqual(git(worker, "merge-base", "--is-ancestor", own, f"origin/{DEFAULT}").returncode, 0)

    def test_competing_pushes_keep_both_changes(self):
        first, first_commit = self.worker("qa")
        second, second_commit = self.worker("planner")
        a, b = self.integration(first), self.integration(second)
        git(a, "push", "origin", f"HEAD:refs/heads/{DEFAULT}")
        self.assertNotEqual(git(b, "push", "origin", f"HEAD:refs/heads/{DEFAULT}", check=False).returncode, 0)
        git(b, "fetch", "origin")
        git(b, "merge", "--no-edit", f"origin/{DEFAULT}")
        git(b, "push", "origin", f"HEAD:refs/heads/{DEFAULT}")
        git(second, "fetch", "origin")
        for commit in [first_commit, second_commit]:
            self.assertEqual(git(second, "merge-base", "--is-ancestor", commit, f"origin/{DEFAULT}").returncode, 0)

    def test_dirty_working_copy_is_preserved(self):
        worker, own = self.worker("qa")
        (worker / "base.txt").write_text("unfinished local work\n")
        before = git(worker, "status", "--porcelain").stdout
        integration = self.integration(worker)
        git(integration, "push", "origin", f"HEAD:refs/heads/{DEFAULT}")
        git(worker, "fetch", "origin")
        self.assertEqual(git(worker, "status", "--porcelain").stdout, before)
        self.assertEqual((worker / "base.txt").read_text(), "unfinished local work\n")
        self.assertEqual(git(worker, "merge-base", "--is-ancestor", own, f"origin/{DEFAULT}").returncode, 0)


if __name__ == "__main__":
    unittest.main()
