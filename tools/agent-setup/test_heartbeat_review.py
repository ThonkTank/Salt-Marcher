import importlib.util
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("heartbeat-review.py")
spec = importlib.util.spec_from_file_location("heartbeat_review", SCRIPT)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class HeartbeatReview(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "history.sqlite"
        with closing(sqlite3.connect(self.path)) as db, db:
            db.executescript("""
                CREATE TABLE thread_turns(thread_id TEXT, turn_id TEXT,
                  first_user_item_id TEXT, status TEXT);
                CREATE TABLE thread_items(thread_id TEXT, item_id TEXT, item_json TEXT);
            """)

    def add(self, n, thread="own", automation="role", heartbeat=True, status="completed"):
        text = (f"<heartbeat>\n <automation_id>{automation}</automation_id>\n"
                "<instructions>Arbeite weiter.</instructions></heartbeat>" if heartbeat else
                "Bitte ändere den Auftrag. Zitat: <heartbeat><automation_id>role</automation_id>")
        item = json.dumps({"type": "userMessage", "content": [{"type": "text", "text": text}]})
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("INSERT INTO thread_turns VALUES(?,?,?,?)", (thread, str(n), str(n), status))
            db.execute("INSERT INTO thread_items VALUES(?,?,?)", (thread, str(n), item))

    def test_tenth_and_twentieth_runs_include_current_in_progress_run(self):
        for n in range(1, 22):
            self.add(n, status="inProgress" if n in (10, 20) else "completed")
            result = review.review_cycle(self.path, "own", "role")
            self.assertEqual(result["lauf"], n)
            self.assertEqual(result["strukturrueckblick"], n % 10 == 0)
            self.assertEqual(result["naechster_rueckblick_bei"], (n // 10 + 1) * 10)

    def test_counts_runs_not_successes_and_ignores_manual_other_chats_and_other_automations(self):
        self.add(1, status="failed")
        self.add(2, status="interrupted")
        self.add(3, heartbeat=False)
        self.add(4, thread="foreign")
        self.add(5, automation="another-role")
        # Repeated projected items do not turn into additional runs.
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("INSERT INTO thread_items VALUES('own','extra',?)", (
                json.dumps({"content": [{"type": "text", "text":
                    "<heartbeat><automation_id>role</automation_id></heartbeat>"}]}),))
        self.assertEqual(review.review_cycle(self.path, "own", "role")["lauf"], 2)

    def test_fresh_chat_starts_its_own_cycle(self):
        for n in range(1, 11):
            self.add(n)
        self.add(11, thread="fresh")
        self.assertTrue(review.review_cycle(self.path, "own", "role")["strukturrueckblick"])
        self.assertEqual(review.review_cycle(self.path, "fresh", "role")["lauf"], 1)

    def test_reads_only_and_does_not_create_a_missing_database(self):
        self.add(1)
        before = {p.name: p.read_bytes() for p in self.path.parent.iterdir()}
        self.assertEqual(review.review_cycle(self.path, "own", "role")["lauf"], 1)
        self.assertEqual({p.name: p.read_bytes() for p in self.path.parent.iterdir()}, before)
        missing = self.path.with_name("missing.sqlite")
        with self.assertRaises(sqlite3.Error):
            review.review_cycle(missing, "own", "role")
        self.assertFalse(missing.exists())

    def test_cli_uses_current_thread_and_reports_unknown_count_as_error(self):
        self.add(1)
        env = {**os.environ, "CODEX_THREAD_ID": "own"}
        run = subprocess.run([sys.executable, str(SCRIPT), "--automation", "role", "--history", str(self.path)],
                             env=env, capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(run.stdout)["lauf"], 1)
        failed = subprocess.run([sys.executable, str(SCRIPT), "--automation", "role", "--history", str(self.path),
                                 "--thread", "absent"], env=env, capture_output=True, text=True)
        self.assertNotEqual(failed.returncode, 0)
        self.assertEqual(failed.stdout, "")
        self.assertIn("Laufzahl ist unbekannt", failed.stderr)


if __name__ == "__main__":
    unittest.main()
