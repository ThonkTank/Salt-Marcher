"""Measure top Smart Tile crop across live and fresh Dungeondraft processes."""
import argparse
import json
import shutil
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
from probe_right_crop import CTRL, Rfb, occupied, open_dialog, screenshot, sha256
from probe_bottom_crop import metadata, shape_polygons, wait_loaded, world, write_result


def resize_and_save(run, info, rfb, value, label):
    open_dialog(rfb)
    rfb.click(631, 241)
    rfb.combo(CTRL, ord("a"))
    for character in str(value):
        rfb.key(True, ord(character))
        rfb.key(False, ord(character))
    rfb.click(784, 320)
    time.sleep(0.5)
    screenshot(run, info["display"], label + "-dialog")
    rfb.click(525, 524)
    screenshot(run, info["display"], label + "-map")
    rfb.click(281, 16)
    time.sleep(0.8)
    source = run / "map/phase1-snap.dungeondraft_map"
    saved = run / "evidence/maps" / (label + ".dungeondraft_map")
    shutil.copy2(source, saved)
    return saved


def probe(run, fresh):
    info = metadata(run)
    source = run / "map/phase1-snap.dungeondraft_map"
    source_hash = sha256(source)
    before = world(source)
    rfb = Rfb(int(info["rfb_port"]))
    try:
        wait_loaded(run, info, "00-loaded")
        if not fresh:
            assert (before["width"], before["height"]) == (12, 10)
            assert len(occupied(before)) == 10
            assert sum(y < 2 for _, y in occupied(before)) == 5
            crop_file = resize_and_save(run, info, rfb, -2, "01-top-minus-two")
            restored_file = resize_and_save(run, info, rfb, 2, "02-top-plus-two")
            crop, restored = world(crop_file), world(restored_file)
            result = {
                "original": "Dungeondraft 1.2.0.1 Opulent Kirin",
                "sourceSha256": source_hash,
                "savedSha256": {"crop": sha256(crop_file), "restored": sha256(restored_file)},
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
        else:
            assert (before["width"], before["height"]) == (12, 8)
            assert len(occupied(before)) == 5
            restored_file = resize_and_save(run, info, rfb, 2, "01-fresh-top-plus-two")
            restored = world(restored_file)
            result = {
                "original": "Dungeondraft 1.2.0.1 Opulent Kirin",
                "sourceSha256": source_hash,
                "savedSha256": sha256(restored_file),
                "sizes": {"before": [12, 8], "restored": [restored["width"], restored["height"]]},
                "occupied": {"before": occupied(before), "restored": occupied(restored)},
                "shapePolygonsEqual": shape_polygons(before) == shape_polygons(restored),
            }
            write_result(run, result)
            assert result["sizes"]["restored"] == [12, 10]
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("--fresh-expand", action="store_true")
    args = parser.parse_args()
    probe(args.run, args.fresh_expand)
