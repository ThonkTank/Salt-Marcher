"""Draw a native Battlements/QAWall01 wall tint and alpha card by UI gestures."""
import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import CTRL, Rfb, metadata

STYLES = [
    ("battlements", "res://textures/walls/battlements.png"),
    ("qa-wall", "res://packs/QAWall01/textures/walls/QA Wall.png"),
]


def capture(run, display, name):
    target = run / "evidence/screens" / f"{name}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return str(target)


def set_hex(rfb, value):
    rfb.click(190, 882)
    rfb.click(125, 852)
    rfb.combo(CTRL, ord("a"))
    for char in value:
        rfb.key(True, ord(char))
        rfb.key(False, ord(char))
        time.sleep(0.045)
    time.sleep(0.2)
    rfb.click(265, 852)


def probe(run, resume, button):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    rows = []
    try:
        for style_index, (style, expected_path) in enumerate(STYLES):
            if style_index * 9 + 8 < resume:
                continue
            rfb.click(*button)
            capture(run, info["display"], f"style-{style}-selected")
            for color_index, (tint, rgb) in enumerate([
                ("white", "ffffff"), ("red", "ff0000"),
                ("mixed", "445566"),
            ]):
                for alpha_index, (alpha_name, alpha) in enumerate([
                    ("zero", "00"), ("half", "80"), ("opaque", "ff"),
                ]):
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
                    # The original may still show the released wall as a
                    # yellow preview for a later frame. Leave the canvas and
                    # wait before reading the saved wall count.
                    rfb.pointer(0, 1170, 700)
                    time.sleep(1.2)
                    drawn = capture(run, info["display"], f"{index:02d}-{style}-{tint}-{alpha_name}")
                    rfb.click(294, 16)
                    time.sleep(1.0)
                    source = run / "map/phase3-package.dungeondraft_map"
                    saved = run / "evidence/maps" / f"{index:02d}.dungeondraft_map"
                    shutil.copy2(source, saved)
                    level = json.loads(saved.read_text())["world"]["levels"]["0"]
                    walls = level["walls"]
                    shapes = level["shapes"]["polygons"]
                    path = walls[-1]["texture"] if walls else None
                    actual = walls[-1]["color"] if walls else None
                    if len(shapes) != index + 1 or len(walls) != index + 1 or path != expected_path:
                        raise AssertionError({"case": index, "shapes": len(shapes),
                                              "walls": len(walls), "path": path,
                                              "expected": expected_path})
                    item = {"index": index, "style": style, "tint": tint,
                            "alpha": alpha_name, "requestedArgb": argb,
                            "storedArgb": actual, "path": path,
                            "cell": [col * 3, row * 3], "drawn": drawn,
                            "savedMap": str(saved)}
                    rows.append(item)
                    print(json.dumps({"index": index, "requested": argb,
                                      "stored": actual, "path": path}), flush=True)
        (run / "evidence/wall-tint-matrix.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("--resume", type=int, default=0)
    parser.add_argument("--button", type=int, nargs=2, required=True)
    args = parser.parse_args()
    probe(args.run, args.resume, args.button)
