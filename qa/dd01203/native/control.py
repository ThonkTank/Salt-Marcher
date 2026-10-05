"""Small RFB recorder for the exclusive, isolated Bau original session."""
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, "/home/aaron/.cache/dungeon-native-qa/workpackages/hand-pan-native-p0")
from run_p0 import Rfb


class Control:
    def __init__(self, run):
        self.run = Path(run)
        self.port = int((self.run / "session.txt").read_text().split("rfb_port=")[1].splitlines()[0])
        self.display = (self.run / "session.txt").read_text().split("display=")[1].splitlines()[0]
        self.map = self.run / "map/bau-01-working.dungeondraft_map"
        self.rfb = Rfb(self.port)
        (self.run / "evidence/maps").mkdir(parents=True, exist_ok=True)

    def close(self):
        self.rfb.close()

    def click(self, x, y):
        self.rfb.click(x, y)

    def double(self, x, y):
        self.rfb.pointer(0, x, y)
        for _ in range(2):
            self.rfb.pointer(1, x, y)
            time.sleep(0.08)
            self.rfb.pointer(0, x, y)
            time.sleep(0.09)
        time.sleep(0.3)

    def press(self, keysym):
        self.rfb.key(True, keysym)
        time.sleep(0.08)
        self.rfb.key(False, keysym)
        time.sleep(0.25)

    def combo(self, modifier, key):
        self.rfb.key(True, modifier)
        time.sleep(0.12)
        self.press(key)
        self.rfb.key(False, modifier)
        time.sleep(0.3)

    def drag(self, start, end, modifier=None, hold=None):
        self.rfb.pointer(0, start[0] + 2, start[1] + 2)
        time.sleep(0.1)
        self.rfb.pointer(0, *start)
        time.sleep(0.15)
        if modifier is not None:
            self.rfb.key(True, modifier)
            time.sleep(0.1)
        self.rfb.pointer(1, *start)
        time.sleep(0.15)
        for step in range(1, 9):
            x = round(start[0] + (end[0] - start[0]) * step / 8)
            y = round(start[1] + (end[1] - start[1]) * step / 8)
            self.rfb.pointer(1, x, y)
            time.sleep(0.07)
        if hold:
            self.screen(hold)
        self.rfb.pointer(0, *end)
        if modifier is not None:
            self.rfb.key(False, modifier)
        time.sleep(0.45)

    def screen(self, label):
        target = self.run / "evidence/screens" / f"{label}.png"
        subprocess.run(["import", "-display", self.display, "-window", "root", str(target)], check=True)
        return target

    def save(self, label):
        self.combo(0xffe3, 0x73)
        time.sleep(1)
        source = self.map
        target = self.run / "evidence/maps" / f"{label}.dungeondraft_map"
        shutil.copy2(source, target)
        data = json.loads(target.read_text())
        level = data["world"]["levels"]["0"]
        value = {
            "label": label,
            "map": str(target),
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "shape_count": len(level["shapes"]["polygons"]),
            "wall_count": len(level["walls"]),
            "portal_count": len(level["portals"]) + sum(len(w.get("portals") or []) for w in level["walls"]),
            "shapes": level["shapes"],
            "walls": level["walls"],
        }
        (self.run / "evidence/maps" / f"{label}.json").write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
        return value


CTRL = 0xffe3
SHIFT = 0xffe1
ALT = 0xffe9
ESC = 0xff1b
DELETE = 0xffff
BACKSPACE = 0xff08
