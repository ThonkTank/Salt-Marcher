"""Draw the same four Building rectangles on an Original wear-on/off map."""
import argparse
import hashlib
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


CASES = (
    ("battlements-default", (400, 340), (528, 468),
     "res://textures/walls/battlements.png", "ff726e65", (14, 16, 8, 10)),
    ("battlements-white", (600, 340), (728, 468),
     "res://textures/walls/battlements.png", "ffffffff", (17, 19, 8, 10)),
    ("qa-white", (800, 340), (928, 468),
     "res://packs/QAWall01/textures/walls/QA Wall.png", "ffffffff",
     (20, 22, 8, 10)),
    ("qa-red", (1000, 340), (1128, 468),
     "res://packs/QAWall01/textures/walls/QA Wall.png", "ffff0000",
     (23, 25, 8, 10)),
)


def capture(run, display, name):
    path = run / "evidence/screens" / f"{name}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(path)],
                   check=True)
    return path


def slow_drag(rfb, start, end):
    # The 35x20 software-rendered map can miss a normal 0.1-second RFB press.
    rfb.pointer(0, *start)
    time.sleep(1.1)
    rfb.pointer(1, *start)
    time.sleep(0.8)
    rfb.pointer(1, *end)
    time.sleep(0.8)
    rfb.pointer(0, *end)
    time.sleep(1.8)


def set_wall_hex(rfb, value):
    rfb.click(190, 882)
    time.sleep(0.7)
    rfb.click(125, 852)
    time.sleep(0.4)
    rfb.combo(CTRL, ord("a"))
    for character in value:
        rfb.key(True, ord(character))
        rfb.key(False, ord(character))
        time.sleep(0.08)
    time.sleep(0.4)
    rfb.click(265, 852)
    time.sleep(0.6)


def check_map(path, expected_wear, case_index):
    world = json.loads(path.read_text())["world"]
    if world["building_wear"] != expected_wear:
        raise AssertionError(("wear", world["building_wear"], expected_wear))
    level = world["levels"]["0"]
    walls = level["walls"]
    shapes = level["shapes"]["polygons"]
    if len(walls) != case_index + 1 or len(shapes) != case_index + 1:
        raise AssertionError(("counts", len(walls), len(shapes), case_index))
    name, _, _, expected_path, expected_color, bounds = CASES[case_index]
    wall = walls[-1]
    numbers = [int(value) for value in re.findall(
        r"-?\d+", wall["points"].split("(", 1)[1])]
    actual_bounds = (min(numbers[0::2]) // 256,
                     max(numbers[0::2]) // 256,
                     min(numbers[1::2]) // 256,
                     max(numbers[1::2]) // 256)
    if (wall["texture"], wall["color"], actual_bounds) != (
            expected_path, expected_color, bounds):
        raise AssertionError((name, wall, actual_bounds, bounds))
    return {"name": name, "texture": wall["texture"],
            "color": wall["color"], "bounds": actual_bounds,
            "buildingWear": world["building_wear"],
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def probe(run, expected_wear, resume):
    info = metadata(run)
    source = run / "map/phase3-package.dungeondraft_map"
    rfb = Rfb(int(info["rfb_port"]))
    rows = []
    try:
        for _ in range(120):
            ready = capture(run, info["display"], "00-wait")
            if Image.open(ready).convert("RGB").getpixel((20, 120))[0] > 70:
                break
            time.sleep(0.4)
        else:
            raise TimeoutError("Original map did not load")
        before = json.loads(source.read_text())["world"]
        if (before["building_wear"] != expected_wear or
                len(before["levels"]["0"]["walls"]) != resume):
            raise AssertionError("Unexpected map or wear mode at resume point")
        if resume == 0:
            rfb.click(20, 80)
            rfb.click(56, 120)
            rfb.click(105, 146)
            capture(run, info["display"], "01-building-tool")
        for index, case in enumerate(CASES):
            if index < resume:
                saved = run / "evidence/maps" / f"{index:02d}-{case[0]}.dungeondraft_map"
                row = check_map(saved, expected_wear, index)
                row["map"] = str(saved)
                row["screenshot"] = str(run / "evidence/screens" /
                                        f"{index:02d}-{case[0]}.png")
                rows.append(row)
                continue
            if index == 1:
                set_wall_hex(rfb, "ffffffff")
            if index == 2:
                for _ in range(9):
                    rfb.pointer(16, 200, 700)
                    rfb.pointer(0, 200, 700)
                    time.sleep(0.12)
                rfb.click(170, 835)
                capture(run, info["display"], "02-qa-selected")
            if index == 3:
                set_wall_hex(rfb, "ffff0000")
            slow_drag(rfb, case[1], case[2])
            rfb.click(294, 16)
            time.sleep(0.7)
            saved = run / "evidence/maps" / f"{index:02d}-{case[0]}.dungeondraft_map"
            shutil.copy2(source, saved)
            row = check_map(saved, expected_wear, index)
            row["map"] = str(saved)
            row["screenshot"] = str(capture(run, info["display"],
                                            f"{index:02d}-{case[0]}"))
            rows.append(row)
            print(json.dumps(row), flush=True)
        rfb.click(291, 904)
        capture(run, info["display"], "final-grid-off")
        (run / "evidence/wear-paired.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("--wear", choices=("on", "off"), required=True)
    parser.add_argument("--resume", type=int, choices=range(len(CASES)), default=0)
    args = parser.parse_args()
    probe(args.run, None if args.wear == "off"
          else "res://textures/wear/grime.png", args.resume)
