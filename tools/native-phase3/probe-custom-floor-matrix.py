"""Draw up to two nine-case Custom Color floor matrices through Original UI."""
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

STYLES = {
    "diamond": ("tileset_diamond", "5b797a"),
    "diamond_2": ("tileset_diamond_2", "e8c4a0"),
    "ornate": ("tileset_ornate", "9f8888"),
    "wood_damaged": ("tileset_wood_damaged", "b28f6f"),
}


def capture(run, display, label):
    target = run / "evidence/screens" / (label + ".png")
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return target


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


def scroll_to_lower_gallery(rfb):
    for _ in range(8):
        rfb.pointer(16, 200, 400)
        rfb.pointer(0, 200, 400)
        time.sleep(0.08)
    time.sleep(0.5)


def matches_slot(shape, col, row):
    numbers = [int(value) for value in re.findall(
        r"-?\d+", shape.split("(", 1)[1])]
    x, y = col * 3 * 256, row * 3 * 256
    return (set(numbers[0::2]) == {x, x + 512}
            and set(numbers[1::2]) == {y, y + 512})


def probe(run, style_names):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    source = run / "map/phase3-package.dungeondraft_map"
    rows = []
    gallery_lower = False
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
        rfb.click(609, 800)  # 50%; 32 px per map cell
        rfb.click(105, 603)  # X/None wall
        capture(run, info["display"], "01-building")
        # Dungeondraft reorders its gallery while loading a map. A baseline
        # save writes that session's gallery ordering to tiles.lookup.
        rfb.click(294, 16)
        time.sleep(0.6)
        baseline = json.loads(source.read_text())["world"]["levels"]["0"]
        lookup = baseline["tiles"]["lookup"]
        if baseline["shapes"]["polygons"] or len(lookup) != 24:
            raise AssertionError("Expected a blank map and 24 gallery styles")
        shutil.copy2(source, run / "evidence/maps/00-baseline.dungeondraft_map")
        style_names = sorted(style_names, key=lambda name: next(
            int(index) for index, path in lookup.items()
            if path == f"res://textures/tilesets/simple/{STYLES[name][0]}.png"))
        for style_index, style_name in enumerate(style_names):
            stem, default_rgb = STYLES[style_name]
            expected_path = f"res://textures/tilesets/simple/{stem}.png"
            gallery_index = next(int(index) for index, path in lookup.items()
                                 if path == expected_path)
            lower = gallery_index >= 12
            if lower and not gallery_lower:
                scroll_to_lower_gallery(rfb)
                gallery_lower = True
                capture(run, info["display"], "02-gallery-lower")
            if not lower and gallery_lower:
                raise AssertionError("Upper gallery style must come first")
            visible = gallery_index % 12
            button = (125 + (visible % 3) * 68,
                      274 + (visible // 3) * 68)
            rfb.click(*button)
            capture(run, info["display"], f"style-{style_name}-selected")
            for color_index, (tint, rgb) in enumerate(
                (("white", "ffffff"), ("default", default_rgb), ("red", "ff0000"))
            ):
                for alpha_index, (alpha_name, alpha) in enumerate(
                    (("zero", "00"), ("half", "80"), ("opaque", "ff"))
                ):
                    index = style_index * 9 + color_index * 3 + alpha_index
                    argb = alpha + rgb
                    set_hex(rfb, argb)
                    col, row = index % 6, index // 6
                    x0, y0 = 352 + col * 96 + 8, 288 + row * 96 + 8
                    rfb.pointer(0, x0, y0)
                    time.sleep(1.1)
                    rfb.drag((x0, y0), (x0 + 64, y0 + 64))
                    drawn = capture(run, info["display"],
                                    f"{index:02d}-{style_name}-{tint}-{alpha_name}")
                    rfb.click(294, 16)
                    time.sleep(0.6)
                    saved = run / "evidence/maps" / f"{index:02d}.dungeondraft_map"
                    shutil.copy2(source, saved)
                    level = json.loads(saved.read_text())["world"]["levels"]["0"]
                    ids = [int(item) for item in re.findall(r"-?\d+", level["tiles"]["cells"])]
                    cells = [(row * 3 + dy) * 18 + col * 3 + dx
                             for dy in (0, 1) for dx in (0, 1)]
                    colors = [level["tiles"]["colors"][cell] for cell in cells]
                    paths = [level["tiles"]["lookup"].get(str(ids[cell]))
                             for cell in cells]
                    actual, path = colors[0], paths[0]
                    slot_shapes = [shape for shape in level["shapes"]["polygons"]
                                   if matches_slot(shape, col, row)]
                    if (len(level["shapes"]["polygons"]) != index + 1
                            or level["walls"] or len(slot_shapes) != 1
                            or any(value != expected_path for value in paths)
                            or any(value != argb for value in colors)):
                        raise AssertionError({"case": index,
                            "shapes": len(level["shapes"]["polygons"]),
                            "slotShapes": len(slot_shapes), "walls": len(level["walls"]),
                            "paths": paths, "colors": colors, "path": path,
                            "expectedPath": expected_path, "argb": actual,
                            "expectedArgb": argb, "saved": str(saved)})
                    rows.append({"index": index, "style": style_name,
                        "tint": tint, "alpha": alpha_name, "requestedArgb": argb,
                        "storedArgb": actual, "path": path,
                        "cell": [col * 3, row * 3], "drawn": str(drawn),
                        "savedMap": str(saved)})
                    print(json.dumps({"index": index, "style": style_name,
                        "argb": actual, "path": path}), flush=True)
        before_grid = capture(run, info["display"], "final-before-grid")
        if Image.open(before_grid).convert("RGB").getpixel((291, 904))[0] > 100:
            rfb.click(291, 904)
        final = capture(run, info["display"], "final-grid-off")
        image = Image.open(final).convert("RGB")
        if image.getpixel((291, 904))[0] > 100 or any(
            image.getpixel((x, y)) != (37, 37, 37)
            for x in range(364, 404) for y in range(300, 340)
        ):
            raise AssertionError("Grid remained visible over the alpha-zero floor")
        (run / "evidence/custom-floor-matrix.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("styles", choices=tuple(STYLES), nargs="+")
    args = parser.parse_args()
    if len(args.styles) > 2:
        parser.error("At most two styles fit the 18x12 card")
    probe(args.run, args.styles)
