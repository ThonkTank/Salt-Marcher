"""Record the original held point/edge Escape effect from an isolated saved map."""
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


def geometry(path):
    level = json.loads(path.read_text())["world"]["levels"]["0"]
    return {"polygons": level["shapes"]["polygons"], "walls": level["walls"],
            "portals": level["portals"]}


def shot(run, display, label):
    target = run / "evidence/screens" / f"{label}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return Image.open(target).convert("RGB")


def save(run, rfb, source, label):
    rfb.combo(CTRL, ord("s"))
    time.sleep(0.7)
    target = run / "evidence/maps" / f"{label}.dungeondraft_map"
    shutil.copy2(source, target)
    return {"file": str(target), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "geometry": geometry(target)}


def gesture(run, display, rfb, source, label, start, end):
    rfb.pointer(0, start[0] + 10, start[1] + 10)
    rfb.pointer(0, *start)
    time.sleep(0.4)
    shot(run, display, label + "-hover")
    rfb.pointer(1, *start)
    time.sleep(0.15)
    for step in range(1, 9):
        at = (round(start[0] + (end[0] - start[0]) * step / 8),
              round(start[1] + (end[1] - start[1]) * step / 8))
        rfb.pointer(1, *at)
        time.sleep(0.06)
    shot(run, display, label + "-held")
    rfb.key(True, 0xff1b)
    time.sleep(0.12)
    rfb.key(False, 0xff1b)
    time.sleep(0.35)
    shot(run, display, label + "-escape-held")
    rfb.pointer(0, *end)
    time.sleep(0.6)
    shot(run, display, label + "-released")
    return save(run, rfb, source, label)


def main(run):
    info = dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)
    source = run / "map/points.dungeondraft_map"
    rfb = Rfb(int(info["rfb_port"]))
    result = {"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "before": geometry(source)}
    try:
        deadline = time.monotonic() + 60
        while True:
            image = shot(run, info["display"], "00-start")
            if image.getpixel((20, 120))[0] > 70:
                break
            if time.monotonic() > deadline:
                raise TimeoutError("Dungeondraft map did not open")
            time.sleep(0.5)
        rfb.click(20, 80)
        rfb.click(56, 120)
        rfb.click(195, 182)
        rfb.click(670, 310)
        shot(run, info["display"], "01-edit-points")
        if os.environ.get("DUNGEON_PHASE2_ESCAPE_MODE", "vertex") == "edge":
            result["edgeEscape"] = gesture(run, info["display"], rfb, source,
                                           "edge", (640, 232), (640, 180))
        else:
            result["vertexEscape"] = gesture(run, info["display"], rfb, source,
                                             "vertex", (768, 232), (720, 275))
        rfb.click(647, 664)
        shot(run, info["display"], "02-zoom-menu")
        (run / "evidence/result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"run": str(run),
                          "vertexChanged": result.get("vertexEscape", {}).get("geometry") != result["before"] if "vertexEscape" in result else None,
                          "edgeChanged": result.get("edgeEscape", {}).get("geometry") != result["before"] if "edgeEscape" in result else None}))
    finally:
        rfb.close()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
