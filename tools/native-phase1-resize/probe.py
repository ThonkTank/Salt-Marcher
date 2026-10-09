"""Isolated Dungeondraft DD-038 Cancel/X probe after an entered top margin."""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-phase1-snap"))
from probe import CTRL, Rfb  # noqa: E402


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def comparable_world(world):
    comparable = json.loads(json.dumps(world))
    for level in comparable["levels"].values():
        tiles = level.get("tiles", {})
        if "lookup" in tiles:
            tiles["lookup"] = sorted(tiles["lookup"].values())
    return comparable


def screenshot(run, display, name):
    path = run / "evidence/screens" / f"{name}.png"
    subprocess.run(["import", "-display", display, "-window", "root", str(path)], check=True)
    return path


def open_dialog(rfb):
    rfb.click(20, 16)
    rfb.click(80, 107)
    time.sleep(0.4)


def top_one(rfb):
    rfb.click(638, 241)
    rfb.combo(CTRL, ord("a"))
    rfb.key(True, ord("1"))
    rfb.key(False, ord("1"))
    rfb.click(640, 194)
    time.sleep(0.3)


def probe(run):
    info = dict(line.split("=", 1) for line in (run / "session.txt").read_text().splitlines() if "=" in line)
    source = run / "map/phase1-snap.dungeondraft_map"
    baseline_hash = sha256(source)
    baseline_world = json.loads(source.read_text())["world"]
    assert baseline_world["width"] == 8 and baseline_world["height"] == 8
    rfb = Rfb(int(info["rfb_port"]))
    try:
        deadline = time.monotonic() + 90
        while True:
            image = screenshot(run, info["display"], "00-loading")
            from PIL import Image
            if Image.open(image).convert("RGB").getpixel((20, 120))[0] > 70:
                break
            if time.monotonic() > deadline:
                raise TimeoutError("Original map did not load")
            time.sleep(0.6)
        screenshot(run, info["display"], "01-loaded")

        open_dialog(rfb)
        screenshot(run, info["display"], "02-dialog")
        top_one(rfb)
        screenshot(run, info["display"], "03-cancel-top-one")
        rfb.click(755, 524)
        screenshot(run, info["display"], "04-after-cancel")
        rfb.click(281, 16)
        time.sleep(0.5)
        after_cancel = run / "evidence/maps/after-cancel.dungeondraft_map"
        shutil.copy2(source, after_cancel)

        open_dialog(rfb)
        screenshot(run, info["display"], "05-reopen-after-cancel")
        top_one(rfb)
        screenshot(run, info["display"], "06-x-top-one")
        rfb.click(865, 152)
        screenshot(run, info["display"], "07-after-x")
        rfb.click(281, 16)
        time.sleep(0.5)
        after_x = run / "evidence/maps/after-x.dungeondraft_map"
        shutil.copy2(source, after_x)

        open_dialog(rfb)
        screenshot(run, info["display"], "08-reopen-after-x")
        top_one(rfb)
        screenshot(run, info["display"], "09-ok-top-one")
        rfb.click(525, 524)
        screenshot(run, info["display"], "10-after-ok")
        rfb.click(281, 16)
        time.sleep(0.6)
        after_ok = run / "evidence/maps/after-ok.dungeondraft_map"
        shutil.copy2(source, after_ok)

        worlds = {name: json.loads(path.read_text())["world"] for name, path in
                  [("cancel", after_cancel), ("x", after_x), ("ok", after_ok)]}
        result = {
            "original": "Dungeondraft 1.2.0.1 Opulent Kirin",
            "sourceSha256": baseline_hash,
            "savedSha256": {name: sha256(path) for name, path in
                            [("cancel", after_cancel), ("x", after_x), ("ok", after_ok)]},
            "dimensions": {name: [world["width"], world["height"]] for name, world in worlds.items()},
            "sameWorldAsSourceExceptLookupOrder": {
                name: comparable_world(world) == comparable_world(baseline_world)
                for name, world in worlds.items()},
            "cancelAndXByteEqual": sha256(after_cancel) == sha256(after_x),
            "screens": [str(p) for p in sorted((run / "evidence/screens").glob("*.png"))],
        }
        (run / "evidence/result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        assert comparable_world(worlds["cancel"]) == comparable_world(baseline_world)
        assert comparable_world(worlds["x"]) == comparable_world(baseline_world)
        assert result["cancelAndXByteEqual"]
        assert worlds["ok"]["width"] == 8 and worlds["ok"]["height"] == 9
        print(json.dumps({"run": str(run), "result": result["dimensions"]}, ensure_ascii=False))
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    probe(parser.parse_args().run)
