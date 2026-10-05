"""DD-012.03: one measured native point drag, then a fresh process check.

run.sh starts and stops the isolated Dungeondraft processes. This driver never
opens the user's map or vault. It refuses to drag if the expected green grip is
not under the pointer at the measured 1280x960 screenshot coordinate.
"""
import hashlib
import json
import re
import sys
import time
from pathlib import Path

from PIL import Image

from control import CTRL, Control


BASE_SHA = "dc3fd5e8cb3c385be85faf3d65ae493b56d0b2717cd55f8b4210c52ff89841ed"
INDEX = 23
GRIP = (512, 456)   # Native screenshot: 2, 5.5 fields at 100%, 64 px/field.
HELD = (456, 456)   # Status bar: 1.13, 5.5 fields; Snap commits x=1 field.


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def ring(path):
    data = json.loads(Path(path).read_text())
    level = data["world"]["levels"]["0"]
    polygon = level["shapes"]["polygons"][0]
    wall = level["walls"][1]["points"]
    values = tuple(int(value) for value in re.findall(
        r"-?\d+", polygon[polygon.find("(") + 1:polygon.rfind(")")]
    ))
    wall_values = tuple(int(value) for value in re.findall(
        r"-?\d+", wall[wall.find("(") + 1:wall.rfind(")")]
    ))
    assert len(values) == 64 and len(wall_values) == 64, "32-point ellipse/wall absent"
    assert values == wall_values, "ellipse floor and wall contour diverged"
    return values


def expect_vertex(values, x):
    assert values[INDEX * 2:INDEX * 2 + 2] == (x, 1408), (
        f"point {INDEX}: {values[INDEX * 2:INDEX * 2 + 2]} != {(x, 1408)}"
    )


def capture(control, name):
    return control.screen(name)


def edit(run):
    control = Control(run)
    try:
        before = ring(control.map)
        expect_vertex(before, 512)
        assert digest(control.map) == BASE_SHA, "source map differs from R2 D03"
        capture(control, "00-open-d03")
        control.click(52, 120)  # Building Tool
        control.click(195, 181)  # Edit Points, measured in R2 D04
        control.rfb.pointer(0, GRIP[0] + 2, GRIP[1] + 2)
        time.sleep(0.1)
        control.rfb.pointer(0, *GRIP)
        time.sleep(0.3)
        hover = capture(control, "01-green-grip")
        red, green, blue = Image.open(hover).convert("RGB").getpixel(GRIP)
        assert green > 145 and green > red * 1.45, (
            f"Edit Points grip not green at {GRIP}: {(red, green, blue)}"
        )
        control.rfb.pointer(1, *GRIP)
        time.sleep(0.15)
        for step in range(1, 9):
            x = round(GRIP[0] + (HELD[0] - GRIP[0]) * step / 8)
            control.rfb.pointer(1, x, HELD[1])
            time.sleep(0.07)
        capture(control, "02-held-floor-wall")
        assert digest(control.map) == BASE_SHA, "map file changed before release"
        control.rfb.pointer(0, *HELD)
        time.sleep(0.4)
        capture(control, "03-released")
        placed = control.save("03-released")
        after = ring(control.map)
        expect_vertex(after, 256)
        assert after[:INDEX * 2] == before[:INDEX * 2]
        assert after[INDEX * 2 + 2:] == before[INDEX * 2 + 2:]
        control.combo(CTRL, ord("z"))
        capture(control, "04-undo")
        control.save("04-undo")
        assert ring(control.map) == before, "Undo did not restore original ellipse"
        control.combo(CTRL, ord("y"))
        capture(control, "05-redo")
        control.save("05-redo")
        assert ring(control.map) == after, "Redo did not restore dragged point"
        (run / "evidence" / "edit-result.json").write_text(json.dumps({
            "baseSha256": BASE_SHA,
            "placedSha256": placed["sha256"],
            "redoSha256": digest(control.map),
            "index": INDEX,
            "before": [512, 1408],
            "after": [256, 1408],
            "untouchedCoordinatesEqual": True,
            "savedWallMatchesFloor": True,
        }, indent=2) + "\n")
    finally:
        control.close()


def reopen(run):
    control = Control(run)
    try:
        previous = json.loads((run / "evidence" / "edit-result.json").read_text())
        assert digest(control.map) == previous["redoSha256"], (
            "saved map changed between processes"
        )
        after = ring(control.map)
        expect_vertex(after, 256)
        capture(control, "06-fresh-open")
        (run / "evidence" / "reopen-result.json").write_text(json.dumps({
            "freshSha256": digest(control.map),
            "point23": [256, 1408],
            "savedWallMatchesFloor": True,
            "screenshot": "screens/06-fresh-open.png",
        }, indent=2) + "\n")
    finally:
        control.close()


if __name__ == "__main__":
    phase, root = sys.argv[1:]
    run = Path(root)
    if phase == "edit":
        edit(run)
    elif phase == "reopen":
        reopen(run)
    else:
        raise SystemExit("phase must be edit or reopen")
