"""Record native Building Floor/Wall field clicks from explicit ARGB starts."""
import argparse
import json
import shutil
import subprocess
import time
from pathlib import Path
import sys

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import CTRL, Rfb, metadata


def capture(run, display, name):
    target = run / "evidence/screens" / f"{name}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return Image.open(target).convert("RGB")


def type_text(rfb, value):
    for char in value:
        keysym = ord(char)
        rfb.key(True, keysym)
        rfb.key(False, keysym)
        time.sleep(0.045)


def set_hex(rfb, x, y, value):
    rfb.click(x, y)
    rfb.combo(CTRL, ord("a"))
    type_text(rfb, value)
    time.sleep(0.25)


def save(run, rfb, name):
    rfb.click(294, 16)
    time.sleep(0.9)
    source = run / "map/phase3-package.dungeondraft_map"
    target = run / "evidence/maps" / f"{name}.dungeondraft_map"
    shutil.copy2(source, target)
    return target


def probe(run):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    try:
        for _ in range(120):
            image = capture(run, info["display"], "00-start")
            if image.getpixel((20, 120))[0] > 70:
                break
            time.sleep(0.4)
        else:
            raise TimeoutError("Original map did not load")
        time.sleep(0.8)
        rfb.click(20, 80)
        rfb.click(56, 120)
        rfb.click(105, 146)
        rfb.click(190, 640)
        building = capture(run, info["display"], "01-building")
        heading = run / "evidence/screens/01-building-title.png"
        building.crop((25, 45, 330, 108)).resize((1220, 252)).save(heading)
        title = subprocess.check_output(["tesseract", str(heading), "stdout"],
                                        stderr=subprocess.DEVNULL, text=True)
        if "Building Tool" not in title:
            raise AssertionError(f"Building Tool not selected: {title!r}")

        # The Floor dialog occupies y=39..534. Its field is x=8..264,
        # y=39..295. Set a known value, close, then reopen before clicking.
        rfb.click(190, 532)
        capture(run, info["display"], "02-floor-open")
        set_hex(rfb, 125, 502, "ffb28f6f")
        capture(run, info["display"], "03-floor-explicit-draft")
        rfb.click(265, 502)
        rfb.click(190, 532)
        capture(run, info["display"], "04-floor-known-start")
        rfb.click(200, 180)
        capture(run, info["display"], "05-floor-field-draft")
        rfb.click(265, 502)
        rfb.drag((464, 304), (528, 368))
        floor_map = save(run, rfb, "01-floor-field")
        capture(run, info["display"], "06-floor-drawn")

        # The Wall dialog is anchored at y=388..883; its field is
        # x=8..264, y=388..646. Use the same relative point as above.
        rfb.click(190, 882)
        capture(run, info["display"], "07-wall-open")
        set_hex(rfb, 125, 852, "ff726e65")
        capture(run, info["display"], "08-wall-explicit-draft")
        rfb.click(265, 852)
        rfb.click(190, 882)
        capture(run, info["display"], "09-wall-known-start")
        rfb.click(200, 529)
        capture(run, info["display"], "10-wall-field-draft")
        rfb.click(265, 852)
        rfb.drag((592, 304), (656, 368))
        wall_map = save(run, rfb, "02-wall-field")
        capture(run, info["display"], "11-wall-drawn")
        data = json.loads(wall_map.read_text())
        level = data["world"]["levels"]["0"]
        if len(level.get("walls", [])) < 2 or len(level["shapes"]["polygons"]) < 2:
            raise AssertionError("Floor and Wall probe Buildings were not stored")
        result = {
            "reference": "Dungeondraft 1.2.0.1 Opulent Kirin",
            "floorStart": "ffb28f6f",
            "wallStart": "ff726e65",
            "floorFieldPoint": [200, 180],
            "wallFieldPoint": [200, 529],
            "floorMap": str(floor_map),
            "wallMap": str(wall_map),
            "walls": level.get("walls", []),
            "tileColors": level.get("tiles", {}).get("colors", []),
        }
        target = run / "evidence/result.json"
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"result": str(target), "wallCount": len(result["walls"])}, ensure_ascii=False))
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    probe(parser.parse_args().run)
