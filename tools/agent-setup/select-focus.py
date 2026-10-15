#!/usr/bin/env python3
"""Print one random current product/planning document, without storing state."""

import argparse
from pathlib import Path
import secrets
import subprocess


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("repository", nargs="?", default=".")
args = parser.parse_args()
root = Path(subprocess.check_output(
    ["git", "-C", args.repository, "rev-parse", "--show-toplevel"], text=True
).strip())
files = subprocess.check_output([
    "git", "-C", str(root), "ls-files", "-z", "--",
    ":(glob)ROADMAP*.md", ":(glob)*PARITY*.md", "ARCHITECTURE.md", "README.md",
    ":(glob)docs/*.md", ":(glob)docs/plans/**/*.md",
]).decode().split("\0")
candidates = [name for name in files if name and (root / name).is_file()]
if not candidates:
    parser.exit(1, "Keine Produkt- oder Planungsdokumente im Repository gefunden.\n")
print(secrets.choice(candidates))
