"""Probe the original point-delete action with recorded keysyms and map states."""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import CTRL, Rfb


def state(path):
    level = json.loads(path.read_text())["world"]["levels"]["0"]
    return {
        "polygons": level["shapes"]["polygons"],
        "walls": level["walls"],
        "portals": level["portals"],
    }


def screenshot(run, display, label):
    target = run / "evidence/screens" / f"{label}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return Image.open(target).convert("RGB")


def press(rfb, key):
    rfb.key(True, key)
    time.sleep(0.12)
    rfb.key(False, key)
    time.sleep(0.4)


def save(run, rfb, source, label):
    rfb.click(294, 16)
    time.sleep(0.9)
    destination = run / "evidence/maps" / f"{label}.dungeondraft_map"
    shutil.copy2(source, destination)
    return {"file": str(destination), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
            "geometry": state(destination)}


def main(run):
    info = dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)
    source = run / "map/points.dungeondraft_map"
    rfb = Rfb(int(info["rfb_port"]))
    keys = {"Q": ord("q"), "Backspace": 0xff08, "Delete": 0xffff}
    coordinate = lambda name, default: tuple(int(value) for value in
                                      os.environ.get(name, default).split(","))
    select_at = coordinate("DUNGEON_PHASE2_SELECT_AT", "670,310")
    first_at = coordinate("DUNGEON_PHASE2_FIRST_AT", "768,232")
    second_at = coordinate("DUNGEON_PHASE2_SECOND_AT", "512,232")
    first_key = os.environ.get("DUNGEON_PHASE2_FIRST_KEY", "Q")
    second_key = os.environ.get("DUNGEON_PHASE2_SECOND_KEY", first_key)
    shortcut_file = run / "data/Dungeondraft/shortcuts.ini"
    data = {"shortcutFile": shortcut_file.read_text() if shortcut_file.exists() else None,
            "firstKey": first_key, "secondKey": second_key,
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "before": state(source)}
    try:
        deadline = time.monotonic() + 60
        while True:
            image = screenshot(run, info["display"], "00-start")
            if image.getpixel((20, 120))[0] > 70:
                break
            if time.monotonic() > deadline:
                raise TimeoutError("Dungeondraft map did not open")
            time.sleep(0.5)
        rfb.click(20, 80)
        rfb.click(56, 120)
        rfb.click(195, 182)
        rfb.click(*select_at)
        screenshot(run, info["display"], "01-edit-points")
        rfb.pointer(0, first_at[0] + 10, first_at[1] + 10)
        time.sleep(0.15)
        rfb.pointer(0, *first_at)
        time.sleep(0.5)
        screenshot(run, info["display"], "02-four-point-hover")
        press(rfb, keys[first_key])
        screenshot(run, info["display"], "03-first-action")
        data["afterFirst"] = save(run, rfb, source, "after-first")
        if len(data["afterFirst"]["geometry"]["polygons"]) == len(data["before"]["polygons"]) and data["afterFirst"]["geometry"]["polygons"] != data["before"]["polygons"]:
            rfb.pointer(0, second_at[0] + 10, second_at[1] + 10)
            time.sleep(0.15)
            rfb.pointer(0, *second_at)
            time.sleep(0.5)
            screenshot(run, info["display"], "04-three-point-hover")
            press(rfb, keys[second_key])
            screenshot(run, info["display"], "05-second-action")
            data["afterSecond"] = save(run, rfb, source, "after-second")
            rfb.combo(CTRL, ord("z"))
            screenshot(run, info["display"], "06-undo")
            data["undo"] = save(run, rfb, source, "undo")
            rfb.combo(CTRL, ord("y"))
            screenshot(run, info["display"], "07-redo")
            data["redo"] = save(run, rfb, source, "redo")
        (run / "evidence/result.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"run": str(run), "before": len(data["before"]["polygons"]),
                          "afterFirst": len(data["afterFirst"]["geometry"]["polygons"]),
                          "afterSecond": len(data.get("afterSecond", {}).get("geometry", {}).get("polygons", [])) if "afterSecond" in data else None}))
    finally:
        rfb.close()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
