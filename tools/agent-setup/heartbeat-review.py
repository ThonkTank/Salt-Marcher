#!/usr/bin/env python3
"""Read the current chat's native heartbeat history; every tenth run reviews structure."""

import argparse
from contextlib import closing
import json
import os
from pathlib import Path
import re
import sqlite3


def review_cycle(history, thread, automation):
    if not thread or not automation:
        raise ValueError("Chat-ID und Automations-ID werden benötigt.")
    with closing(sqlite3.connect(history.resolve().as_uri() + "?mode=ro", uri=True)) as db:
        rows = db.execute(
            "SELECT i.item_json FROM thread_turns t JOIN thread_items i "
            "ON i.thread_id=t.thread_id AND i.item_id=t.first_user_item_id "
            "WHERE t.thread_id=?", (thread,))
        count = 0
        for (raw,) in rows:
            item = json.loads(raw)
            text = "\n".join(c.get("text", "") for c in item.get("content", [])
                             if c.get("type") == "text")
            match = re.match(r"\s*<heartbeat>\s*<automation_id>([^<]+)</automation_id>", text)
            if match and match[1] == automation:
                count += 1
    if not count:
        raise ValueError("Keine passenden Heartbeat-Läufe im aktuellen Chat gefunden; Laufzahl ist unbekannt.")
    return {"lauf": count, "strukturrueckblick": count % 10 == 0,
            "naechster_rueckblick_bei": ((count // 10) + 1) * 10}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--automation", required=True)
    parser.add_argument("--thread", default=os.environ.get("CODEX_THREAD_ID"))
    home = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
    parser.add_argument("--history", type=Path, default=home / "thread_history_1.sqlite")
    args = parser.parse_args()
    try:
        result = review_cycle(args.history, args.thread, args.automation)
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, f"Rückblick-Rhythmus nicht ermittelbar: {error}\n")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
