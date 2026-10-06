"""Freshly open an existing Dungeondraft point-edit map and compare its saved geometry."""
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import CTRL, Rfb


def shape_state(path):
    level = json.loads(path.read_text())["world"]["levels"]["0"]
    return {key: level[key] for key in ("shapes", "walls", "portals")}


def capture(run, display, label):
    path = run / "evidence/screens" / f"{label}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(path)], check=True)
    return Image.open(path).convert("RGB")


def main(run):
    info = dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)
    source = run / "map/points.dungeondraft_map"
    before = shape_state(source)
    rfb = Rfb(int(info["rfb_port"]))
    try:
        deadline = time.monotonic() + 65
        while True:
            image = capture(run, info["display"], "fresh-open")
            if image.getpixel((20, 120))[0] > 70:
                break
            if time.monotonic() > deadline:
                raise TimeoutError("Dungeondraft did not open the saved map")
            time.sleep(0.5)
        time.sleep(1)
        rfb.combo(CTRL, ord("s"))
        time.sleep(1)
        capture(run, info["display"], "fresh-saved")
        after = shape_state(source)
        assert after == before, "Fresh original save changed stored point geometry"
        saved = run / "evidence/maps/fresh-saved.dungeondraft_map"
        saved.write_bytes(source.read_bytes())
        result = {"source": str(run), "geometryEqual": True,
                  "polygonCount": len(after["shapes"]["polygons"]),
                  "wallCount": len(after["walls"]),
                  "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                  "saved": str(saved)}
        (run / "evidence/result.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result))
    finally:
        rfb.close()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
