"""Measure right-edge Smart Tile crop and re-expansion in isolated Dungeondraft."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import CTRL, Rfb  # noqa: E402


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def screenshot(run, display, name):
    target = run / "evidence/screens" / f"{name}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return target


def cells(world):
    return [int(value) for value in re.findall(
        r"-?\d+", world["levels"]["0"]["tiles"]["cells"])]


def occupied(world):
    width = world["width"]
    return sorted((index % width, index // width)
                  for index, value in enumerate(cells(world)) if value >= 0)


def enter_right(rfb, value):
    rfb.click(789, 320)
    rfb.combo(CTRL, ord("a"))
    for character in str(value):
        rfb.key(True, ord(character))
        rfb.key(False, ord(character))
    rfb.click(640, 194)
    time.sleep(0.3)


def open_dialog(rfb):
    rfb.click(20, 16)
    rfb.click(80, 107)
    time.sleep(0.4)


def probe(run):
    info = dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)
    source = run / "map/phase1-snap.dungeondraft_map"
    source_sha256 = sha256(source)
    before = json.loads(source.read_text())["world"]
    assert (before["width"], before["height"]) == (12, 8)
    assert len(occupied(before)) == 10
    assert sum(x >= 9 for x, _ in occupied(before)) == 6
    rfb = Rfb(int(info["rfb_port"]))
    try:
        from PIL import Image
        deadline = time.monotonic() + 90
        while True:
            image = screenshot(run, info["display"], "00-loading")
            if Image.open(image).convert("RGB").getpixel((20, 120))[0] > 70:
                break
            if time.monotonic() > deadline:
                raise TimeoutError("Original source map did not load")
            time.sleep(0.6)
        screenshot(run, info["display"], "01-loaded")
        open_dialog(rfb)
        enter_right(rfb, -3)
        screenshot(run, info["display"], "02-right-minus-three")
        rfb.click(525, 524)
        screenshot(run, info["display"], "03-cropped")
        rfb.click(281, 16)
        time.sleep(0.8)
        crop_file = run / "evidence/maps/after-right-minus-three.dungeondraft_map"
        shutil.copy2(source, crop_file)

        open_dialog(rfb)
        enter_right(rfb, 3)
        screenshot(run, info["display"], "04-right-plus-three")
        rfb.click(525, 524)
        screenshot(run, info["display"], "05-restored")
        rfb.click(281, 16)
        time.sleep(0.8)
        restore_file = run / "evidence/maps/after-right-plus-three.dungeondraft_map"
        shutil.copy2(source, restore_file)

        crop = json.loads(crop_file.read_text())["world"]
        restored = json.loads(restore_file.read_text())["world"]
        result = {
            "original": "Dungeondraft 1.2.0.1 Opulent Kirin",
            "sourceSha256": source_sha256,
            "savedSha256": {"crop": sha256(crop_file), "restored": sha256(restore_file)},
            "sizes": {"before": [12, 8], "crop": [crop["width"], crop["height"]],
                      "restored": [restored["width"], restored["height"]]},
            "occupied": {"before": occupied(before), "crop": occupied(crop),
                         "restored": occupied(restored)},
            "shapePolygonsEqual": {
                "crop": crop["levels"]["0"]["shapes"]["polygons"]
                  == before["levels"]["0"]["shapes"]["polygons"],
                "restored": restored["levels"]["0"]["shapes"]["polygons"]
                  == before["levels"]["0"]["shapes"]["polygons"],
            },
            "sameSessionRecoveredHiddenCells": occupied(restored) == occupied(before),
        }
        (run / "evidence/result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        assert result["sizes"] == {"before": [12, 8], "crop": [9, 8], "restored": [12, 8]}
        assert len(result["occupied"]["crop"]) == 4
        assert result["sameSessionRecoveredHiddenCells"]
        assert all(result["shapePolygonsEqual"].values())
        print(json.dumps({"run": str(run), "sizes": result["sizes"],
                          "cells": {k: len(v) for k, v in result["occupied"].items()}},
                         ensure_ascii=False))
    finally:
        rfb.close()


def fresh_expand(run):
    info = dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)
    source = run / "map/phase1-snap.dungeondraft_map"
    source_sha256 = sha256(source)
    before = json.loads(source.read_text())["world"]
    assert (before["width"], before["height"]) == (9, 8)
    assert len(occupied(before)) == 4
    rfb = Rfb(int(info["rfb_port"]))
    try:
        from PIL import Image
        deadline = time.monotonic() + 90
        while True:
            image = screenshot(run, info["display"], "00-loading")
            if Image.open(image).convert("RGB").getpixel((20, 120))[0] > 70:
                break
            if time.monotonic() > deadline:
                raise TimeoutError("Cropped map did not load")
            time.sleep(0.6)
        screenshot(run, info["display"], "01-fresh-cropped")
        open_dialog(rfb)
        enter_right(rfb, 3)
        screenshot(run, info["display"], "02-fresh-right-plus-three")
        rfb.click(525, 524)
        screenshot(run, info["display"], "03-fresh-restored")
        rfb.click(281, 16)
        time.sleep(0.8)
        saved = run / "evidence/maps/after-fresh-right-plus-three.dungeondraft_map"
        shutil.copy2(source, saved)
        after = json.loads(saved.read_text())["world"]
        result = {
            "original": "Dungeondraft 1.2.0.1 Opulent Kirin",
            "sourceSha256": source_sha256,
            "savedSha256": sha256(saved),
            "sizes": {"before": [9, 8], "restored": [after["width"], after["height"]]},
            "occupied": {"before": occupied(before), "restored": occupied(after)},
            "shapePolygonsEqual": before["levels"]["0"]["shapes"]["polygons"]
              == after["levels"]["0"]["shapes"]["polygons"],
        }
        (run / "evidence/result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        assert result["sizes"]["restored"] == [12, 8]
        assert result["occupied"]["restored"] == result["occupied"]["before"]
        assert result["shapePolygonsEqual"]
        print(json.dumps({"run": str(run), "cells": len(result["occupied"]["restored"])},
                         ensure_ascii=False))
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("--fresh-expand", action="store_true")
    args = parser.parse_args()
    fresh_expand(args.run) if args.fresh_expand else probe(args.run)
