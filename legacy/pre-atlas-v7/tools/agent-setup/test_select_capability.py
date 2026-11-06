import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("select-capability.py")
spec = importlib.util.spec_from_file_location("select_capability", SCRIPT)
selector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(selector)


def entry(name, areas=None, **extra):
    return {"bereiche": areas or ["reference"], "ablauf": name, "verglichen_mit": [], **extra}


class CapabilityCatalog(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = self.root / "capabilities.json"

    def save(self, entries):
        self.path.write_text(json.dumps(entries), encoding="utf-8")

    def cli(self, *args, ok=True):
        result = subprocess.run([sys.executable, str(SCRIPT), "--catalog", str(self.root), *args],
                                capture_output=True, text=True, timeout=10)
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def git_repo(self):
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)

    def test_migration_preserves_workflows_and_comparisons_without_invented_checks(self):
        old = [entry("Spur öffnen", verglichen_mit=["Kanka"]), entry("Karte zeichnen", ["maps"])]
        self.save(old)
        before = self.path.read_bytes()
        data = selector.read_catalog(self.path)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(data["auswahlen_pro_rolle"], {})
        for original, migrated in zip(old, data["capabilities"]):
            for key, value in original.items():
                self.assertEqual(migrated[key], value)
            self.assertEqual(migrated["testdateien"], [])
            self.assertIsNone(migrated["zuletzt_geprueft"])
            self.assertIsNone(migrated["zuletzt_ausgewaehlt"])
        self.cli("--migrieren")
        once = self.path.read_bytes()
        self.cli("--migrieren")
        self.assertEqual(self.path.read_bytes(), once)

    def test_oldest_considers_selection_and_actual_review_with_stable_ties(self):
        self.save([
            entry("Erst kürzlich geprüft", zuletzt_ausgewaehlt="2026-01-01T00:00:00Z", zuletzt_geprueft="2026-03-01T00:00:00Z"),
            entry("Am längsten nicht berücksichtigt", zuletzt_ausgewaehlt="2026-02-01T00:00:00Z"),
            entry("Ungeprüft 1"), entry("Ungeprüft 2"),
        ])
        self.assertEqual(selector.select_capability(self.path, role="qa")["ablauf"], "Ungeprüft 1")
        self.assertEqual(selector.select_capability(self.path, role="realist")["ablauf"], "Ungeprüft 2")
        self.assertEqual(selector.select_capability(self.path, role="planner")["ablauf"], "Am längsten nicht berücksichtigt")
        self.assertEqual(selector.select_capability(self.path, role="qa")["ablauf"], "Erst kürzlich geprüft")

    def test_every_third_entry_is_new_independently_for_each_role(self):
        self.save([entry(str(i)) for i in range(12)])
        for number in range(1, 7):
            for role in ("qa", "realist", "planner"):
                chosen = selector.select_capability(self.path, role=role)
                self.assertEqual(chosen is None, number % 3 == 0)
        self.assertEqual(selector.read_catalog(self.path)["auswahlen_pro_rolle"],
                         {"qa": 6, "realist": 6, "planner": 6})

    def test_legacy_area_calls_and_default_all_have_independent_counters(self):
        self.save([entry("Spur"), entry("Weg", ["maps"]), entry("Kampf", ["encounter"])])
        for area, name in [("notes", "Spur"), ("map", "Weg"), ("encounter", "Kampf")]:
            self.assertEqual(selector.select_capability(self.path, area)["ablauf"], name)
        selector.select_capability(self.path)
        self.assertEqual(selector.read_catalog(self.path)["auswahlen_pro_rolle"],
                         {"notes": 1, "map": 1, "encounter": 1, "qa": 1})

    def test_empty_catalog_or_empty_area_always_offers_new(self):
        for entries in ([], [entry("Notiz")]):
            self.save(entries)
            for _ in range(4):
                self.assertIsNone(selector.select_capability(self.path, "encounter"))

    def test_selection_is_not_a_completed_review_and_abandoned_entries_return(self):
        self.save([entry("A"), entry("B")])
        first = selector.select_capability(self.path)
        self.assertIsNotNone(first["zuletzt_ausgewaehlt"])
        self.assertIsNone(first["zuletzt_geprueft"])
        self.assertEqual(selector.select_capability(self.path)["ablauf"], "B")
        self.assertIsNone(selector.select_capability(self.path))
        self.assertEqual(selector.select_capability(self.path)["ablauf"], "A")

    def test_new_entry_is_recently_assigned_but_unchecked(self):
        self.save([entry("Noch unbekannt")])
        new = selector.update_catalog(self.path, "Neu", areas=["maps"])
        self.assertIsNotNone(new["zuletzt_ausgewaehlt"])
        self.assertIsNone(new["zuletzt_geprueft"])
        self.assertEqual(selector.select_capability(self.path)["ablauf"], "Noch unbekannt")

    def test_file_links_merge_remove_and_do_not_imply_a_review(self):
        self.git_repo()
        test = self.root / "tests/check.test.mjs"
        test.parent.mkdir()
        test.write_text("// test fixture\n")
        self.save([entry("A"), entry("B")])
        for workflow in ("A", "B"):
            result = selector.update_catalog(self.path, workflow, tests=["tests/check.test.mjs"], repo=self.root)
            self.assertIsNone(result["zuletzt_geprueft"])
        selector.update_catalog(self.path, "A", tests=["tests/./check.test.mjs"], repo=self.root)
        self.assertEqual(selector.read_catalog(self.path)["capabilities"][0]["testdateien"], ["tests/check.test.mjs"])
        result = selector.update_catalog(self.path, "A", checked=True)
        self.assertIsNotNone(result["zuletzt_geprueft"])
        test.unlink()
        selector.update_catalog(self.path, "A", remove_tests=["tests/check.test.mjs"])
        self.assertEqual(selector.read_catalog(self.path)["capabilities"][0]["testdateien"], [])

    def test_invalid_test_paths_and_missing_files_do_not_change_catalog(self):
        self.git_repo()
        self.save([entry("A")])
        before = self.path.read_bytes()
        for name in ("/tmp/a.test.mjs", "../a.test.mjs", "tests\\a.test.mjs", "missing.test.mjs"):
            with self.subTest(path=name), self.assertRaises(ValueError):
                selector.update_catalog(self.path, "A", tests=[name], repo=self.root)
            self.assertEqual(self.path.read_bytes(), before)
        (self.root / "outside").symlink_to("/etc/hosts")
        with self.assertRaises(ValueError):
            selector.update_catalog(self.path, "A", tests=["outside"], repo=self.root)

    def test_overview_is_read_only_and_shows_shared_unassigned_and_missing_files(self):
        self.git_repo()
        for name in ("tests/shared.test.mjs", "tests/unassigned.test.ts", "tools/test-desktop-example.mjs", "tests/helper.mjs"):
            path = self.root / name
            path.parent.mkdir(exist_ok=True)
            path.write_text("// fixture\n")
        subprocess.run(["git", "-C", str(self.root), "add", "tests", "tools"], check=True)
        self.save([entry("A", testdateien=["tests/shared.test.mjs", "tests/missing.test.mjs"]),
                   entry("B", testdateien=["tests/shared.test.mjs"])])
        before = self.path.read_bytes()
        rows = {e["testdatei"]: e for e in selector.test_overview(self.path, self.root)}
        self.assertEqual(rows["tests/shared.test.mjs"]["ablaeufe"], ["A", "B"])
        self.assertEqual(rows["tests/unassigned.test.ts"]["ablaeufe"], [])
        self.assertTrue(rows["tests/missing.test.mjs"]["fehlt"])
        self.assertIn("tools/test-desktop-example.mjs", rows)
        self.assertNotIn("tests/helper.mjs", rows)
        self.assertEqual(self.path.read_bytes(), before)

    def test_failed_atomic_replace_keeps_existing_catalog(self):
        self.save([entry("A")])
        before = self.path.read_bytes()
        with patch.object(selector.os, "replace", side_effect=OSError("simulated disk error")):
            with self.assertRaises(OSError):
                selector.select_capability(self.path)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual({p.name for p in self.root.iterdir()}, {"capabilities.json", "capabilities.lock"})

    def test_concurrent_selection_never_loses_counters_or_repeats_available_work(self):
        self.save([entry(str(i)) for i in range(25)])
        processes = [subprocess.Popen([sys.executable, str(SCRIPT), "--catalog", str(self.root), "--rolle", role],
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                     for _ in range(6) for role in ("qa", "realist", "planner")]
        workflows = []
        new_count = 0
        for process in processes:
            out, error = process.communicate(timeout=15)
            self.assertEqual(process.returncode, 0, error)
            choice = out.splitlines()[-1]
            if choice == "Neue Capability":
                new_count += 1
            else:
                workflows.append(json.loads(choice)["ablauf"])
        self.assertEqual(new_count, 6)
        self.assertEqual(len(workflows), len(set(workflows)))
        self.assertEqual(selector.read_catalog(self.path)["auswahlen_pro_rolle"], {"qa": 6, "realist": 6, "planner": 6})

    def test_parallel_updates_preserve_entries_comparisons_and_selection_counters(self):
        self.save([entry("Alt")])
        selector.select_capability(self.path)
        processes = [subprocess.Popen([sys.executable, str(SCRIPT), "--catalog", str(self.root),
                                      "--ablauf", "Gemeinsam" if i < 10 else "Anderer Ablauf",
                                      "--bereiche", "reference" if i % 2 else "encounter",
                                      "--verglichen-mit", f"Produkt {i}"],
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                     for i in range(12)]
        for process in processes:
            _, error = process.communicate(timeout=15)
            self.assertEqual(process.returncode, 0, error)
        data = selector.read_catalog(self.path)
        self.assertEqual(data["auswahlen_pro_rolle"], {"qa": 1})
        self.assertEqual(len(data["capabilities"]), 3)
        shared = next(e for e in data["capabilities"] if e["ablauf"] == "Gemeinsam")
        self.assertEqual(set(shared["bereiche"]), {"reference", "encounter"})
        self.assertEqual(set(shared["verglichen_mit"]), {f"Produkt {i}" for i in range(10)})

    def test_invalid_catalogs_are_rejected_without_rewriting(self):
        for invalid in ({}, [entry(" ")], [entry("A"), entry(" a ")], [entry("A", bereiche=[])],
                        [entry("A", extra="unexpected")], [entry("A", testdateien=["../escape"])],
                        [entry("A", zuletzt_geprueft="yesterday")],
                        {"capabilities": [], "auswahlen_pro_rolle": {"qa": True}}):
            with self.subTest(invalid=invalid):
                self.save(invalid)
                before = self.path.read_bytes()
                with self.assertRaises((ValueError, TypeError)):
                    selector.select_capability(self.path)
                self.assertEqual(self.path.read_bytes(), before)

    def test_cli_updates_require_a_workflow_and_read_modes_cannot_select(self):
        self.save([entry("A")])
        before = self.path.read_bytes()
        for args in [("--geprueft",), ("--tests", "tests/a.test.mjs"),
                     ("--testuebersicht", "--ablauf", "A"), ("--rolle", "unknown")]:
            self.cli(*args, ok=False)
            self.assertEqual(self.path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
