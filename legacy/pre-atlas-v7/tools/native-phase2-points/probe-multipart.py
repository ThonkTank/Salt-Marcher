"""Observe deletion of one disjoint outline in a two-part original Building."""
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import CTRL, Rfb


def points(shape):
    coordinates = shape.split("(", 1)[1].split(")", 1)[0]
    values = [int(value) for value in re.findall(r"-?\d+", coordinates)]
    return list(zip(values[::2], values[1::2]))


def screen(run, display, label):
    target = run / "evidence/screens" / f"{label}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return Image.open(target).convert("RGB")


def save(run, rfb, source, label):
    rfb.click(294, 16)
    time.sleep(0.7)
    target = run / "evidence/maps" / f"{label}.dungeondraft_map"
    shutil.copy2(source, target)
    level = json.loads(target.read_text())["world"]["levels"]["0"]
    return {"path": str(target), "polygons": level["shapes"]["polygons"],
            "walls": level["walls"], "portals": level["portals"]}


def hover(rfb, point):
    x, y = round(384 + point[0] / 4), round(104 + point[1] / 4)
    rfb.pointer(0, x + 10, y + 10)
    time.sleep(0.15)
    rfb.pointer(0, x, y)
    time.sleep(0.4)


def backspace(rfb):
    rfb.key(True, 0xff08)
    time.sleep(0.12)
    rfb.key(False, 0xff08)
    time.sleep(0.4)


def main(run):
    info = dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)
    source = run / "map/points.dungeondraft_map"
    rfb = Rfb(int(info["rfb_port"]))
    data = {}
    try:
        deadline = time.monotonic() + 60
        while True:
            image = screen(run, info["display"], "00-start")
            if image.getpixel((20, 120))[0] > 70:
                break
            if time.monotonic() > deadline:
                raise TimeoutError("Dungeondraft map did not open")
            time.sleep(0.5)
        data["before"] = save(run, rfb, source, "before")
        rfb.click(20, 80)
        rfb.click(56, 120)
        rfb.click(105, 146)
        rfb.drag((450, 488), (578, 584))
        screen(run, info["display"], "01-second-drawn")
        data["twoParts"] = save(run, rfb, source, "two-parts")
        if len(data["twoParts"]["polygons"]) != 2:
            raise AssertionError("Second disjoint polygon was not drawn")
        second = max(data["twoParts"]["polygons"], key=lambda value: sum(y for _, y in points(value)))
        corners = points(second)
        rfb.click(195, 182)
        first_grip = max(corners, key=lambda point: (point[0], -point[1]))
        hover(rfb, first_grip)
        screen(run, info["display"], "02-four-point-hover")
        backspace(rfb)
        data["triangle"] = save(run, rfb, source, "triangle")
        screen(run, info["display"], "03-triangle")
        second_after = max(data["triangle"]["polygons"], key=lambda value: sum(y for _, y in points(value)))
        second_grip = min(points(second_after), key=lambda point: (point[0], point[1]))
        hover(rfb, second_grip)
        screen(run, info["display"], "04-three-point-hover")
        backspace(rfb)
        data["onePart"] = save(run, rfb, source, "one-part")
        screen(run, info["display"], "05-one-part")
        rfb.combo(CTRL, ord("z"))
        data["undo"] = save(run, rfb, source, "undo")
        rfb.combo(CTRL, ord("y"))
        data["redo"] = save(run, rfb, source, "redo")
        (run / "evidence/result.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({k: [len(points(p)) for p in v["polygons"]] for k, v in data.items()}))
    finally:
        rfb.close()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
