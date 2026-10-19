#!/usr/bin/env python3
"""Select the least recently considered workflow and maintain its test-file links."""

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import tempfile


DEFAULT_CATALOG = Path.home() / ".local/share/saltmarcher/capabilities"
TESTER_AREAS = {
    "map": {"maps", "dungeon", "hex"},
    "notes": {"reference", "worldplanner", "sessionplanner", "session", "campaign"},
    "encounter": {"encounter", "encountertable", "party", "loot", "creatures"},
}
ROLES = ("qa", "realist", "planner", *TESTER_AREAS)
ENTRY_FIELDS = {"bereiche", "ablauf", "verglichen_mit", "testdateien",
                "zuletzt_ausgewaehlt", "zuletzt_geprueft"}


def normalized(value):
    return " ".join(value.casefold().split())


def now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def timestamp(value):
    if value is None:
        return float("-inf")
    date = datetime.fromisoformat(value)
    if date.tzinfo is None:
        raise ValueError("Zeitpunkte benötigen eine Zeitzone.")
    return date.timestamp()


def test_path(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or ".." in path.parts or "\\" in value or str(path) == ".":
        raise ValueError("Testdateien benötigen repositoryrelative Pfade: " + value)
    return path.as_posix()


def read_catalog(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        data = {"capabilities": data, "auswahlen_pro_rolle": {}}
    if not isinstance(data, dict) or set(data) != {"capabilities", "auswahlen_pro_rolle"}:
        raise ValueError("Der Katalog benötigt capabilities und auswahlen_pro_rolle.")
    if not isinstance(data["capabilities"], list) or not isinstance(data["auswahlen_pro_rolle"], dict):
        raise ValueError("Ungültige Capability-Liste oder Auswahlzähler.")
    for role, count in data["auswahlen_pro_rolle"].items():
        if role not in ROLES or type(count) is not int or count < 0:
            raise ValueError("Ungültiger Rollen-Auswahlzähler.")
    seen = set()
    for entry in data["capabilities"]:
        if not isinstance(entry, dict) or not {"bereiche", "ablauf", "verglichen_mit"} <= set(entry) <= ENTRY_FIELDS:
            raise ValueError("Ungültige Capability-Felder.")
        workflow = entry["ablauf"]
        if not isinstance(workflow, str) or not workflow.strip() or normalized(workflow) in seen:
            raise ValueError("Leerer oder doppelter Ablauf.")
        seen.add(normalized(workflow))
        entry.setdefault("testdateien", [])
        for field in ("bereiche", "verglichen_mit", "testdateien"):
            values = entry[field]
            if not isinstance(values, list) or any(not isinstance(v, str) or not v.strip() for v in values):
                raise ValueError(field + " muss eine Liste nichtleerer Namen sein.")
            keys = [test_path(v) if field == "testdateien" else normalized(v) for v in values]
            if len(set(keys)) != len(values) or (field == "bereiche" and not values):
                raise ValueError("Leere Bereiche oder doppelte Namen in " + field)
        for field in ("zuletzt_ausgewaehlt", "zuletzt_geprueft"):
            value = entry.setdefault(field, None)
            if value is not None and not isinstance(value, str):
                raise ValueError("Ungültiger Zeitpunkt in " + field)
            timestamp(value)
    return data


def write_catalog(path, data):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as output:
            temporary = Path(output.name)
            json.dump(data, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


@contextmanager
def catalog_lock(path):
    with path.with_suffix(".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def repository_root(repo=None):
    result = subprocess.run(["git", "-C", str(repo or Path.cwd()), "rev-parse", "--show-toplevel"],
                            capture_output=True, text=True, check=True)
    return Path(result.stdout.strip()).resolve()


def update_catalog(path, workflow, areas=(), products=(), tests=(), remove_tests=(), checked=False, repo=None):
    tests = [test_path(value) for value in tests]
    remove_tests = {test_path(value) for value in remove_tests}
    if set(tests) & remove_tests:
        raise ValueError("Dieselbe Testdatei nicht zugleich hinzufügen und entfernen.")
    if tests:
        root = repository_root(repo)
        for value in tests:
            target = (root / value).resolve()
            if not target.is_relative_to(root) or not target.is_file():
                raise ValueError("Testdatei fehlt in dieser Arbeitskopie: " + value)
    with catalog_lock(path):
        data = read_catalog(path)
        entries = data["capabilities"]
        entry = next((e for e in entries if normalized(e["ablauf"]) == normalized(workflow)), None)
        if entry is None:
            if not areas or not workflow.strip():
                raise ValueError("Ein neuer Ablauf benötigt mindestens einen Bereich.")
            entry = {"bereiche": [], "ablauf": workflow.strip(), "verglichen_mit": [], "testdateien": [],
                     "zuletzt_ausgewaehlt": now(), "zuletzt_geprueft": None}
            entries.append(entry)
        for field, values in (("bereiche", areas), ("verglichen_mit", products), ("testdateien", tests)):
            for value in values:
                if not value.strip():
                    raise ValueError("Namen dürfen nicht leer sein.")
                key = value if field == "testdateien" else normalized(value)
                if key not in {v if field == "testdateien" else normalized(v) for v in entry[field]}:
                    entry[field].append(value.strip())
        entry["testdateien"] = [p for p in entry["testdateien"] if p not in remove_tests]
        if checked:
            entry["zuletzt_geprueft"] = now()
        write_catalog(path, data)
        return entry


def select_capability(path, tester="all", role=None):
    role = role or ("qa" if tester == "all" else tester)
    with catalog_lock(path):
        data = read_catalog(path)
        count = data["auswahlen_pro_rolle"].get(role, 0) + 1
        entries = [e for e in data["capabilities"] if tester == "all"
                   or TESTER_AREAS[tester].intersection(e["bereiche"])]
        selection = None
        if entries and count % 3:
            selection = min(entries, key=lambda e: max(timestamp(e["zuletzt_ausgewaehlt"]),
                                                       timestamp(e["zuletzt_geprueft"])))
            selection["zuletzt_ausgewaehlt"] = now()
        data["auswahlen_pro_rolle"][role] = count
        write_catalog(path, data)
        return selection


def test_overview(path, repo=None):
    root = repository_root(repo)
    data = read_catalog(path)
    files = subprocess.run(["git", "-C", str(root), "ls-files", "-z"],
                           capture_output=True, check=True).stdout.decode().split("\0")
    inventory = {p for p in files if ".test." in Path(p).name
                 or (p.startswith("tools/test-desktop-") and p.endswith(".mjs"))}
    links = {}
    for entry in data["capabilities"]:
        for name in entry["testdateien"]:
            links.setdefault(name, []).append(entry["ablauf"])
    return [{"testdatei": name, "ablaeufe": links.get(name, []), "fehlt": not (root / name).is_file()}
            for name in sorted(inventory | links.keys())]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tester", choices=(*TESTER_AREAS, "all"), nargs="?", default="all")
    parser.add_argument("--rolle", choices=ROLES)
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--ablauf")
    parser.add_argument("--bereiche", nargs="+", default=[])
    parser.add_argument("--verglichen-mit", nargs="+", default=[])
    parser.add_argument("--tests", nargs="+", default=[])
    parser.add_argument("--entferne-tests", nargs="+", default=[])
    parser.add_argument("--geprueft", action="store_true")
    parser.add_argument("--repo", type=Path)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--testuebersicht", action="store_true")
    modes.add_argument("--migrieren", action="store_true")
    args = parser.parse_args()
    if (args.bereiche or args.verglichen_mit or args.tests or args.entferne_tests or args.geprueft) and args.ablauf is None:
        parser.error("Änderungen benötigen --ablauf.")
    if (args.testuebersicht or args.migrieren) and args.ablauf is not None:
        parser.error("Übersicht und Migration nicht mit --ablauf kombinieren.")
    path = args.catalog.expanduser() / "capabilities.json"
    try:
        if args.testuebersicht:
            print(json.dumps(test_overview(path, args.repo), ensure_ascii=False, indent=2))
            return
        if args.migrieren:
            with catalog_lock(path):
                data = read_catalog(path)
                write_catalog(path, data)
            print("Katalog migriert:", path)
            return
        if args.ablauf is not None:
            entry = update_catalog(path, args.ablauf, args.bereiche, args.verglichen_mit,
                                   args.tests, args.entferne_tests, args.geprueft, args.repo)
            print(json.dumps(entry, ensure_ascii=False))
            return
        selection = select_capability(path, args.tester, args.rolle)
    except (OSError, ValueError, TypeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"{path}: {error}\n")
    print("Katalog:", path)
    print("Neue Capability" if selection is None else json.dumps(selection, ensure_ascii=False))


if __name__ == "__main__":
    main()
