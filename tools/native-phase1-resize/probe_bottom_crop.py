"""Measure bottom Smart Tile crop across live and fresh Dungeondraft processes."""
import argparse
import json
import shutil
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
from probe_right_crop import CTRL, Rfb, occupied, open_dialog, screenshot, sha256


def metadata(run):
    return dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)


def wait_loaded(run, info, label):
    from PIL import Image
    deadline = time.monotonic() + 90
    while True:
        shot = screenshot(run, info["display"], label)
        if Image.open(shot).convert("RGB").getpixel((20, 120))[0] > 70:
            return
        if time.monotonic() > deadline:
            raise TimeoutError("Original map did not load")
        time.sleep(0.6)


def enter_bottom(rfb, value):
    rfb.click(632, 401)
    rfb.combo(CTRL, ord("a"))
    for character in str(value):
        rfb.key(True, ord(character))
        rfb.key(False, ord(character))
    rfb.click(784, 320)
    time.sleep(0.5)


def resize_and_save(run, info, rfb, value, label):
    open_dialog(rfb)
    enter_bottom(rfb, value)
    screenshot(run, info["display"], label + "-dialog")
    rfb.click(525, 524)
    screenshot(run, info["display"], label + "-map")
    rfb.click(281, 16)
    time.sleep(0.8)
    source = run / "map/phase1-snap.dungeondraft_map"
    saved = run / "evidence/maps" / (label + ".dungeondraft_map")
    shutil.copy2(source, saved)
    return saved


def shape_polygons(world):
    return world["levels"]["0"]["shapes"]["polygons"]


def world(path):
    return json.loads(path.read_text())["world"]


def write_result(run, result):
    (run / "evidence/result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"run": str(run), "sizes": result["sizes"],
                      "cells": {key: len(value) for key, value in result["occupied"].items()}},
                     ensure_ascii=False))


def probe(run, mode):
    info = metadata(run)
    source = run / "map/phase1-snap.dungeondraft_map"
    source_hash = sha256(source)
    before = world(source)
    rfb = Rfb(int(info["rfb_port"]))
    try:
        wait_loaded(run, info, "00-loaded")
        if mode == "prepare":
            assert (before["width"], before["height"]) == (12, 8)
            prepared_file = resize_and_save(run, info, rfb, 2, "01-bottom-plus-two")
            prepared = world(prepared_file)
            result = {
                "original": "Dungeondraft 1.2.0.1 Opulent Kirin",
                "mode": mode,
                "sourceSha256": source_hash,
                "savedSha256": sha256(prepared_file),
                "sizes": {"before": [12, 8], "prepared": [prepared["width"], prepared["height"]]},
                "occupied": {"before": occupied(before), "prepared": occupied(prepared)},
            }
            write_result(run, result)
            assert result["sizes"]["prepared"] == [12, 10]
            return
        if mode == "same-process":
            assert (before["width"], before["height"]) == (12, 10)
            assert len(occupied(before)) == 10
            assert sum(y >= 8 for _, y in occupied(before)) == 5
            crop_file = resize_and_save(run, info, rfb, -2, "01-bottom-minus-two")
            restore_file = resize_and_save(run, info, rfb, 2, "02-bottom-plus-two")
            crop, restored = world(crop_file), world(restore_file)
            result = {
                "original": "Dungeondraft 1.2.0.1 Opulent Kirin",
                "mode": mode,
                "sourceSha256": source_hash,
                "savedSha256": {"crop": sha256(crop_file), "restored": sha256(restore_file)},
                "sizes": {"before": [12, 10], "crop": [crop["width"], crop["height"]],
                          "restored": [restored["width"], restored["height"]]},
                "occupied": {"before": occupied(before), "crop": occupied(crop),
                             "restored": occupied(restored)},
                "shapePolygonsEqual": {"crop": shape_polygons(before) == shape_polygons(crop),
                                       "restored": shape_polygons(before) == shape_polygons(restored)},
            }
            write_result(run, result)
            assert result["sizes"] == {"before": [12, 10], "crop": [12, 8], "restored": [12, 10]}
            assert len(result["occupied"]["crop"]) == 5
            assert all(result["shapePolygonsEqual"].values())
            return
        assert mode == "fresh-expand"
        assert (before["width"], before["height"]) == (12, 8)
        assert len(occupied(before)) == 5
        restored_file = resize_and_save(run, info, rfb, 2, "01-fresh-bottom-plus-two")
        restored = world(restored_file)
        result = {
            "original": "Dungeondraft 1.2.0.1 Opulent Kirin",
            "mode": mode,
            "sourceSha256": source_hash,
            "savedSha256": sha256(restored_file),
            "sizes": {"before": [12, 8], "restored": [restored["width"], restored["height"]]},
            "occupied": {"before": occupied(before), "restored": occupied(restored)},
            "shapePolygonsEqual": shape_polygons(before) == shape_polygons(restored),
        }
        write_result(run, result)
        assert result["sizes"]["restored"] == [12, 10]
        assert result["shapePolygonsEqual"]
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("--mode", choices=("prepare", "same-process", "fresh-expand"), required=True)
    args = parser.parse_args()
    probe(args.run, args.mode)
