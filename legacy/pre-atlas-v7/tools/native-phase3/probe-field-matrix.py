"""Measure Building Floor and Wall field clicks from fixed ARGB starts.

Use an isolated 8x8 empty map opened by run.sh at its default 100% zoom.
Every test draws into a distinct 1x1 cell and saves one final map.
"""
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
from probe import CTRL, Rfb, metadata

POINTS = [(0.02, 0.02), (0.25, 0.25), (0.5, 0.5),
          (0.75, 141 / 256), (0.98, 0.98), (0.9, 0.1), (0.1, 0.9)]
STARTS = {"floor": "ffb28f6f", "wall": "ff726e65"}


def screenshot(run, display, name):
    target = run / "evidence/screens" / f"{name}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return str(target)


def type_text(rfb, value):
    for char in value:
        rfb.key(True, ord(char))
        rfb.key(False, ord(char))
        time.sleep(0.045)


def set_hex(rfb, y, value):
    rfb.click(125, y)
    rfb.combo(CTRL, ord("a"))
    type_text(rfb, value)
    time.sleep(0.2)


def run_probe(run):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    rows = []
    try:
        for _ in range(120):
            ready = screenshot(run, info["display"], "00-ready")
            if Image.open(ready).convert("RGB").getpixel((20, 120))[0] > 70:
                break
            time.sleep(0.4)
        else:
            raise TimeoutError("Original map did not load")
        time.sleep(0.8)
        rfb.click(20, 80)
        rfb.click(56, 120)
        rfb.click(105, 146)
        rfb.click(100, 602)  # X/None during the Floor row
        building = screenshot(run, info["display"], "01-building")
        title = run / "evidence/screens/01-building-title.png"
        Image.open(building).crop((25, 45, 330, 108)).resize((1220, 252)).save(title)
        recognized = subprocess.check_output(["tesseract", str(title), "stdout"],
                                             stderr=subprocess.DEVNULL, text=True)
        if "Building Tool" not in recognized:
            raise AssertionError(f"Building Tool not selected: {recognized!r}")
        for kind in ("floor", "wall"):
            if kind == "wall":
                rfb.click(190, 640)  # built-in battlements wall
            for index, (saturation, value_from_top) in enumerate(POINTS):
                picker_y = 532 if kind == "floor" else 882
                hex_y = 502 if kind == "floor" else 852
                field_y = 39 if kind == "floor" else 388
                rfb.click(190, picker_y)
                set_hex(rfb, hex_y, STARTS[kind])
                rfb.click(265, hex_y)
                rfb.click(190, picker_y)
                before = screenshot(run, info["display"], f"{kind}-{index:02d}-start")
                x = round(8 + 256 * saturation)
                y = round(field_y + 256 * value_from_top)
                rfb.click(x, y)
                after = screenshot(run, info["display"], f"{kind}-{index:02d}-field")
                rfb.click(265, hex_y)
                # Buildings that touch merge in Dungeondraft. Leave one empty
                # cell between probes so every wall keeps its own ARGB value.
                col = (index % 4) * 2
                row = (0 if kind == "floor" else 4) + (index // 4) * 2
                x0 = 384 + col * 64 + 16
                y0 = 224 + row * 64 + 16
                rfb.pointer(0, x0, y0)
                time.sleep(0.25)
                rfb.drag((x0, y0), (x0 + 64, y0 + 64))
                drawn = screenshot(run, info["display"], f"{kind}-{index:02d}-drawn")
                rows.append({"kind": kind, "index": index,
                             "startArgb": STARTS[kind],
                             "fraction": [(x - 8) / 256,
                                          (y - (39 if kind == "floor" else 389)) / 256],
                             "fieldPixel": [x, y], "cell": [col, row],
                             "before": before, "after": after, "drawn": drawn})
        rfb.click(294, 16)
        time.sleep(1)
        source = run / "map/phase3-package.dungeondraft_map"
        target = run / "evidence/maps/field-matrix.dungeondraft_map"
        shutil.copy2(source, target)
        level = json.loads(target.read_text())["world"]["levels"]["0"]
        ids = [int(item) for item in re.findall(r"-?\d+", level["tiles"]["cells"])]
        walls = level["walls"]
        if len(level["shapes"]["polygons"]) != 14 or len(walls) != 7:
            raise AssertionError({"shapes": len(level["shapes"]["polygons"]),
                                  "walls": len(walls)})
        for item in rows:
            col, row = item["cell"]
            offset = row * 8 + col
            assert ids[offset] >= 0
            item["storedFloorArgb"] = level["tiles"]["colors"][offset]
            if item["kind"] == "wall":
                item["storedWallArgb"] = walls[item["index"]]["color"]
        result = {"reference": "Dungeondraft 1.2.0.1 Opulent Kirin",
                  "map": str(target), "rows": rows}
        (run / "evidence/field-matrix.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"map": str(target), "rows": len(rows),
                          "wallColors": [row["storedWallArgb"] for row in rows
                                         if row["kind"] == "wall"]}))
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    run_probe(parser.parse_args().run)
