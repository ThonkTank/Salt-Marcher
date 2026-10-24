#!/usr/bin/env python3
"""Print one random original requirement and its pinned source, without state."""

import argparse
import json
from pathlib import Path
import secrets
import subprocess


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("repository", nargs="?", default=".")
args = parser.parse_args()
root = Path(subprocess.check_output(
    ["git", "-C", args.repository, "rev-parse", "--show-toplevel"], text=True
).strip())
candidates = json.loads((root / "docs/project/requirements/sources.json").read_text())["source_requirements"]
if not candidates:
    parser.exit(1, "Keine Originalanforderungen im Quellenregister gefunden.\n")
requirement = secrets.choice(candidates)
print("Thema:", requirement["title"])
print("Originalanforderung:", requirement["url"])
