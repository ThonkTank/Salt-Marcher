"""Probe a controlled two-portal original map near an inserted replacement wall."""
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import CTRL, Rfb


def shape(path):
    level = json.loads(path.read_text())["world"]["levels"]["0"]
    return {"polygons": level["shapes"]["polygons"], "walls": level["walls"],
            "portals": level["portals"]}


def shot(run, display, label):
    target = run / "evidence/screens" / f"{label}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return Image.open(target).convert("RGB")


def save(run, rfb, source, label):
    rfb.combo(CTRL, ord("s"))
    time.sleep(0.6)
    target = run / "evidence/maps" / f"{label}.dungeondraft_map"
    shutil.copy2(source, target)
    return {"file": str(target), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "geometry": shape(target)}


def main(run):
    info = dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)
    source = run / "map/points.dungeondraft_map"
    rfb = Rfb(int(info["rfb_port"]))
    result = {"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "source": shape(source)}
    try:
        deadline = time.monotonic() + 60
        while True:
            image = shot(run, info["display"], "00-start")
            if image.getpixel((20, 120))[0] > 70:
                break
            if time.monotonic() > deadline:
                raise TimeoutError("Dungeondraft map did not open")
            time.sleep(0.5)
        result["opened"] = save(run, rfb, source, "opened")
        rfb.click(20, 80)
        rfb.click(56, 120)
        rfb.click(195, 182)
        rfb.click(670, 310)
        rfb.pointer(0, 650, 242)
        rfb.pointer(0, 640, 232)
        time.sleep(0.4)
        shot(run, info["display"], "01-midpoint-hover")
        rfb.drag((640, 232), (640, 168))
        shot(run, info["display"], "02-inserted")
        result["inserted"] = save(run, rfb, source, "inserted")
        rfb.combo(CTRL, ord("z"))
        result["undo"] = save(run, rfb, source, "undo")
        rfb.combo(CTRL, ord("y"))
        result["redo"] = save(run, rfb, source, "redo")
        (run / "evidence/result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"run": str(run),
                          "portals": [len(row["geometry"]["walls"][0]["portals"])
                                      for row in (result["opened"], result["inserted"],
                                                  result["undo"], result["redo"])]}))
    finally:
        rfb.close()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
