"""Record each visible native Floor gallery choice and its drawn map cells.

Use after selecting Building Rectangle, 50% zoom, X/None wall, and a blank
18x12 map. The first 12 entries are visible at the top; scroll the gallery
to its lower half before --start 12. Each run preserves the current map.
"""
import argparse
import json
import re
import shutil
import subprocess
import time
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import Rfb, metadata


def capture(run, display, name):
    target = run / "evidence/screens" / f"{name}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return target


def tile_ids(level):
    return [int(value) for value in re.findall(r"-?\d+", level["tiles"]["cells"])]


def run_gallery(run, start, stop):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    results = []
    try:
        for index in range(start, stop):
            visible = index % 12
            x = 125 + (visible % 3) * 68
            y = 274 + (visible // 3) * 68
            rfb.click(x, y)
            selected = capture(run, info["display"], f"{index:02d}-selected")
            column = index % 6
            row = index // 6
            x0 = 352 + column * 96 + 8
            y0 = 288 + row * 96 + 8
            # Godot needs one rendered frame at the destination before the
            # press; otherwise it can reuse the last canvas pointer position.
            rfb.pointer(0, x0, y0)
            time.sleep(0.65)
            rfb.drag((x0, y0), (x0 + 64, y0 + 64))
            drawn = capture(run, info["display"], f"{index:02d}-drawn")
            rfb.click(294, 16)
            source = run / "map/phase3-package.dungeondraft_map"
            saved = run / "evidence/maps" / f"{index:02d}-drawn.dungeondraft_map"
            shutil.copy2(source, saved)
            level = json.loads(saved.read_text())["world"]["levels"]["0"]
            shapes = level["shapes"]["polygons"]
            cells = tile_ids(level)
            indices = [(row * 3 + dy) * 18 + column * 3 + dx
                       for dy in (0, 1) for dx in (0, 1)]
            actual = [cells[cell] for cell in indices]
            # Dungeondraft reorders its gallery on reopening a populated map.
            # Read the persisted ID of the tile painted by this UI slot.
            if len(shapes) != index + 1 or len(level["walls"]) != 0 or min(actual) < 0 or len(set(actual)) != 1:
                raise AssertionError({"index": index, "shapeCount": len(shapes),
                                      "wallCount": len(level["walls"]),
                                      "tileIds": actual, "saved": str(saved)})
            tile_id = actual[0]
            results.append({"gallerySlot": index, "tileId": tile_id,
                            "texturePath": level["tiles"]["lookup"][str(tile_id)],
                            "color": [level["tiles"]["colors"][cell] for cell in indices],
                            "selectedScreenshot": str(selected), "drawnScreenshot": str(drawn),
                            "savedMap": str(saved)})
            print(json.dumps({"slot": index, "tileId": tile_id,
                              "path": results[-1]["texturePath"]}), flush=True)
        target = run / "evidence" / f"gallery-{start:02d}-{stop-1:02d}.json"
        target.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--stop", type=int, default=12)
    args = parser.parse_args()
    run_gallery(args.run, args.start, args.stop)
