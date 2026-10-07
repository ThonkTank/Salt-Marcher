"""Measure original Edit Points grip hover at 100% and 75% zoom."""
import json
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import Rfb


def shot(run, display, label):
    target = run / "evidence/screens" / f"{label}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return Image.open(target).convert("RGB")


def marker(image, center, kind):
    x0, y0 = center
    pixels = (image.getpixel((x, y)) for y in range(y0 - 8, y0 + 9)
              for x in range(x0 - 8, x0 + 9))
    if kind == "vertex":
        return sum(g > r + 45 and g > b + 35 and g > 145 for r, g, b in pixels)
    return sum(r > 190 and g > 150 and b < 130 for r, g, b in pixels)


def sweep(run, display, rfb, zoom, kind, center):
    rows = []
    for offset in [0, 12, 14, 15, 16, 17, 18, 19, 20]:
        rfb.pointer(0, center[0] + 35, center[1] - 35)
        rfb.pointer(0, center[0], center[1] - offset)
        time.sleep(0.2)
        image = shot(run, display, f"{zoom}-{kind}-{offset:02d}")
        rows.append({"offsetPx": offset, "markerPixels": marker(image, center, kind)})
    return rows


def main(run):
    info = dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)
    rfb = Rfb(int(info["rfb_port"]))
    result = {}
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
        result["100"] = {
            "vertex": sweep(run, info["display"], rfb, "100", "vertex", (768, 232)),
            "edge": sweep(run, info["display"], rfb, "100", "edge", (640, 232)),
        }
        rfb.click(647, 664)
        rfb.click(604, 532)
        time.sleep(0.6)
        shot(run, info["display"], "75-zoom")
        result["75"] = {
            "vertex": sweep(run, info["display"], rfb, "75", "vertex", (736, 264)),
            "edge": sweep(run, info["display"], rfb, "75", "edge", (640, 264)),
        }
        (run / "evidence/result.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps({"run": str(run), "result": result}))
    finally:
        rfb.close()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
