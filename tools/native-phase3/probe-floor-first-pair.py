"""Draw Wood Vertical then Diamond as the first two Original floor gestures."""
import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import Rfb, metadata


STYLES = (
    ("wood_vertical", "res://textures/tilesets/smart/tileset_wood_vertical.png",
     "ffb28f6f", 0, 0),
    ("diamond", "res://textures/tilesets/simple/tileset_diamond.png",
     "ff5b797a", 0, 1),
)


def capture(run, display, label):
    target = run / "evidence/screens" / f"{label}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return target


def slot_shape(shape, col, row):
    numbers = [int(value) for value in re.findall(r"-?\d+", shape.split("(", 1)[1])]
    x, y = col * 3 * 256, row * 3 * 256
    return (set(numbers[0::2]) == {x, x + 512}
            and set(numbers[1::2]) == {y, y + 512})


def main(run):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    source = run / "map/phase3-package.dungeondraft_map"
    rows = []
    try:
        for _ in range(120):
            ready = capture(run, info["display"], "00-ready")
            if Image.open(ready).convert("RGB").getpixel((20, 120))[0] > 70:
                break
            time.sleep(0.4)
        else:
            raise TimeoutError("Original map did not load")
        rfb.click(20, 80)
        rfb.click(56, 120)
        rfb.click(105, 146)
        rfb.click(648, 904)
        rfb.click(609, 800)  # 50%; 32 px per field
        rfb.click(105, 603)  # X/None wall
        capture(run, info["display"], "01-building-ready")
        rfb.click(294, 16)
        time.sleep(0.6)
        world = json.loads(source.read_text())["world"]
        baseline = world["levels"]["0"]
        lookup = baseline["tiles"]["lookup"]
        if (world["width"], world["height"]) != (18, 12) or baseline["shapes"]["polygons"] or len(lookup) != 24:
            raise AssertionError("Expected a blank 18x12 map and 24 gallery styles")
        shutil.copy2(source, run / "evidence/maps/00-baseline.dungeondraft_map")
        for index, (name, expected_path, argb, col, row) in enumerate(STYLES):
            gallery_index = next(int(number) for number, path in lookup.items()
                                 if path == expected_path)
            if gallery_index >= 12:
                for _ in range(8):
                    rfb.pointer(16, 200, 400)
                    rfb.pointer(0, 200, 400)
                    time.sleep(0.08)
                time.sleep(0.5)
            visible = gallery_index % 12
            button = (125 + visible % 3 * 68, 274 + visible // 3 * 68)
            before = capture(run, info["display"], f"{index:02d}-{name}-before")
            rfb.click(*button)
            selected = capture(run, info["display"], f"{index:02d}-{name}-selected")
            x0, y0 = 352 + col * 96 + 8, 288 + row * 96 + 8
            rfb.pointer(0, x0, y0)
            time.sleep(1.1)
            rfb.drag((x0, y0), (x0 + 64, y0 + 64))
            drawn = capture(run, info["display"], f"{index:02d}-{name}-drawn")
            rfb.click(294, 16)
            time.sleep(0.6)
            saved = run / "evidence/maps" / f"{index:02d}-{name}.dungeondraft_map"
            shutil.copy2(source, saved)
            level = json.loads(saved.read_text())["world"]["levels"]["0"]
            cells = [int(value) for value in re.findall(r"-?\d+", level["tiles"]["cells"])]
            positions = [(row * 3 + dy) * 18 + col * 3 + dx
                         for dy in (0, 1) for dx in (0, 1)]
            paths = [level["tiles"]["lookup"].get(str(cells[pos])) for pos in positions]
            colors = [level["tiles"]["colors"][pos] for pos in positions]
            shapes = level["shapes"]["polygons"]
            if (len(shapes) != index + 1 or level["walls"]
                    or sum(slot_shape(shape, col, row) for shape in shapes) != 1
                    or paths != [expected_path] * 4 or colors != [argb] * 4):
                raise AssertionError({"index": index, "shapeCount": len(shapes),
                                      "paths": paths, "colors": colors,
                                      "expectedPath": expected_path,
                                      "expectedArgb": argb, "saved": str(saved)})
            rows.append({"index": index, "style": name, "galleryIndex": gallery_index,
                         "argb": argb, "path": expected_path, "cell": [col * 3, row * 3],
                         "before": str(before), "selected": str(selected),
                         "drawn": str(drawn), "savedMap": str(saved)})
            print(json.dumps({"index": index, "style": name, "path": expected_path}), flush=True)
        (run / "evidence/floor-first-pair.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    main(parser.parse_args().run)
