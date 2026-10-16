"""Record Original Building wall-gallery clicks on a blank 18x12 map at 50%."""
import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import Rfb, metadata


def capture(run, display, name):
    target = run / "evidence/screens" / f"{name}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    return str(target)


def probe(run, slots):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    source = run / "map/phase3-package.dungeondraft_map"
    rows = []
    try:
        for index, y in slots:
            rfb.click(186, y)
            chosen = capture(run, info["display"], f"wall-{index:02d}-selected")
            col, row = index % 6, index // 6
            x0, y0 = 352 + col * 96 + 8, 288 + row * 96 + 8
            rfb.pointer(0, x0, y0)
            time.sleep(0.55)
            rfb.drag((x0, y0), (x0 + 64, y0 + 64))
            drawn = capture(run, info["display"], f"wall-{index:02d}-drawn")
            rfb.click(294, 16)
            time.sleep(0.7)
            saved = run / "evidence/maps" / f"wall-{index:02d}.dungeondraft_map"
            shutil.copy2(source, saved)
            level = json.loads(saved.read_text())["world"]["levels"]["0"]
            walls = level["walls"]
            shapes = level["shapes"]["polygons"]
            if len(walls) != index + 1 or len(shapes) != index + 1:
                raise AssertionError({"slot": index, "walls": len(walls),
                                      "shapes": len(shapes), "saved": str(saved)})
            wall = walls[-1]
            item = {"slot": index, "galleryY": y, "cell": [col * 3, row * 3],
                    "wall": wall, "selected": chosen, "drawn": drawn,
                    "savedMap": str(saved)}
            rows.append(item)
            print(json.dumps({"slot": index, "wall": wall.get("texture"),
                              "color": wall.get("color")}), flush=True)
        target = run / "evidence" / f"wall-gallery-{slots[0][0]:02d}-{slots[-1][0]:02d}.json"
        target.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("slots", nargs="+", help="slot:y pairs such as 0:641")
    args = parser.parse_args()
    probe(args.run, [tuple(map(int, slot.split(":"))) for slot in args.slots])
