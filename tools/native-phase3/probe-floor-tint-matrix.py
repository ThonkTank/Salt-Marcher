"""Draw a native Wood/Diamond 2 tint and alpha diagnostic card by UI gestures."""
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

STYLES = [
    ("wood", (125, 274), "res://textures/tilesets/smart/tileset_wood_vertical.png", "b28f6f"),
    ("diamond2", (193, 478), "res://textures/tilesets/simple/tileset_diamond_2.png", "e5d38b"),
]


def capture(run, display, name):
    target = run / "evidence/screens" / f"{name}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return str(target)


def type_text(rfb, value):
    for char in value:
        rfb.key(True, ord(char))
        rfb.key(False, ord(char))
        time.sleep(0.045)


def set_hex(rfb, value):
    rfb.click(190, 532)
    rfb.click(125, 502)
    rfb.combo(CTRL, ord("a"))
    type_text(rfb, value)
    time.sleep(0.2)
    rfb.click(265, 502)


def probe(run, resume=0, diamond_button=None):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    rows = []
    try:
        for _ in range(120):
            ready = capture(run, info["display"], "00-ready")
            if Image.open(ready).convert("RGB").getpixel((20, 120))[0] > 70:
                break
            time.sleep(0.4)
        else:
            raise TimeoutError("Original map did not load")
        if resume == 0:
            rfb.click(20, 80)
            rfb.click(56, 120)
            rfb.click(105, 146)
            rfb.click(648, 904)
            rfb.click(609, 800)  # 50%; 32 px per map cell
            rfb.click(105, 603)  # X/None wall
            capture(run, info["display"], "01-building")
        for style_index, (style, button, expected_path, default_rgb) in enumerate(STYLES):
            if style_index * 9 + 8 < resume:
                continue
            if style == "diamond2" and diamond_button:
                button = diamond_button
            rfb.click(*button)
            capture(run, info["display"], f"style-{style}-selected")
            for color_index, (tint, rgb) in enumerate(
                [("white", "ffffff"), ("default", default_rgb), ("red", "ff0000")]
            ):
                for alpha_index, (alpha_name, alpha) in enumerate(
                    [("zero", "00"), ("half", "80"), ("opaque", "ff")]
                ):
                    index = style_index * 9 + color_index * 3 + alpha_index
                    if index < resume:
                        continue
                    argb = alpha + rgb
                    set_hex(rfb, argb)
                    col, row = index % 6, index // 6
                    x0, y0 = 352 + col * 96 + 8, 288 + row * 96 + 8
                    rfb.pointer(0, x0, y0)
                    time.sleep(0.55)
                    rfb.drag((x0, y0), (x0 + 64, y0 + 64))
                    drawn = capture(run, info["display"], f"{index:02d}-{style}-{tint}-{alpha_name}")
                    rfb.click(294, 16)
                    time.sleep(0.55)
                    source = run / "map/phase3-package.dungeondraft_map"
                    saved = run / "evidence/maps" / f"{index:02d}.dungeondraft_map"
                    shutil.copy2(source, saved)
                    level = json.loads(saved.read_text())["world"]["levels"]["0"]
                    shapes = level["shapes"]["polygons"]
                    tiles = level["tiles"]
                    ids = [int(item) for item in re.findall(r"-?\d+", tiles["cells"])]
                    cell = row * 3 * 18 + col * 3
                    actual = tiles["colors"][cell]
                    tile_id = ids[cell]
                    path = tiles["lookup"].get(str(tile_id))
                    if len(shapes) != index + 1 or len(level["walls"]) != 0 or path != expected_path:
                        raise AssertionError({"case": index, "shapes": len(shapes),
                                              "walls": len(level["walls"]),
                                              "path": path, "expected": expected_path})
                    item = {"index": index, "style": style, "tint": tint,
                            "alpha": alpha_name, "requestedArgb": argb,
                            "storedArgb": actual, "path": path,
                            "cell": [col * 3, row * 3], "drawn": drawn,
                            "savedMap": str(saved)}
                    rows.append(item)
                    print(json.dumps({"index": index, "requested": argb,
                                      "stored": actual, "path": path}), flush=True)
        (run / "evidence/tint-matrix.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("--resume", type=int, default=0)
    parser.add_argument("--diamond-button", type=int, nargs=2)
    args = parser.parse_args()
    probe(args.run, args.resume, args.diamond_button)
