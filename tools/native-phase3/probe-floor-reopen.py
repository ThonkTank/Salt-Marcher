"""Capture a loaded Original floor matrix before and after hiding the grid."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import Rfb, metadata


def capture(run, display, label):
    target = run / "evidence/screens" / (label + ".png")
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return target


def probe(run, floor_first_pair=False):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    source = run / "map/phase3-package.dungeondraft_map"
    try:
        for _ in range(120):
            before = capture(run, info["display"], "00-reopened")
            if Image.open(before).convert("RGB").getpixel((20, 120))[0] > 70:
                break
            time.sleep(0.4)
        else:
            raise TimeoutError("Original map did not load")
        rfb.click(20, 80)
        rfb.click(56, 120)
        rfb.click(648, 904)
        rfb.click(609, 800)  # 50%; 32 px per map cell
        after = capture(run, info["display"], "01-reopened-grid-off")
        for _ in range(2):
            if Image.open(after).convert("RGB").getpixel((291, 904))[0] <= 100:
                break
            rfb.click(291, 904)
            time.sleep(0.6)
            after = capture(run, info["display"], "01-reopened-grid-off")
        image = np.asarray(Image.open(after).convert("RGB"))
        if image[904, 291, 0] > 100:
            raise AssertionError("Grid remained visible")
        if not floor_first_pair and not np.all(image[300:340, 364:404] == 37):
            raise AssertionError("Alpha-zero field still contains grid or incomplete floor")
        rfb.click(294, 16)
        time.sleep(0.6)
        saved = run / "evidence/maps/reopened.dungeondraft_map"
        shutil.copy2(source, saved)
        level = json.loads(saved.read_text())["world"]["levels"]["0"]
        if floor_first_pair:
            cells = [int(value) for value in re.findall(r"-?\d+", level["tiles"]["cells"])]
            expected = (
                (0, "res://textures/tilesets/smart/tileset_wood_vertical.png", "ffb28f6f"),
                (3, "res://textures/tilesets/simple/tileset_diamond.png", "ff5b797a"),
            )
            if len(level["shapes"]["polygons"]) != 2 or level["walls"]:
                raise AssertionError("Expected two floor shapes and no walls")
            for row, path, color in expected:
                positions = [(row + dy) * 18 + dx for dy in (0, 1) for dx in (0, 1)]
                paths = [level["tiles"]["lookup"].get(str(cells[pos])) for pos in positions]
                colors = [level["tiles"]["colors"][pos] for pos in positions]
                if paths != [path] * 4 or colors != [color] * 4:
                    raise AssertionError({"row": row, "paths": paths, "colors": colors})
        outcome = {"before": str(before), "after": str(after),
                   "map": str(saved), "sha256": hashlib.sha256(saved.read_bytes()).hexdigest(),
                   "shapes": len(level["shapes"]["polygons"]),
                   "walls": len(level["walls"])}
        (run / "evidence/reopen.json").write_text(
            json.dumps(outcome, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(outcome), flush=True)
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("--floor-first-pair", action="store_true")
    args = parser.parse_args()
    probe(args.run, args.floor_first_pair)
