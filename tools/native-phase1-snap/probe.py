"""Measure Dungeondraft 1.2.0.1 Snap state around two save gestures."""
import argparse
import hashlib
import json
import shutil
import socket
import struct
import subprocess
import time
from pathlib import Path

from PIL import Image


CTRL = 0xFFE3


def receive(sock, size):
    data = b""
    while len(data) < size:
        part = sock.recv(size - len(data))
        if not part:
            raise EOFError(size)
        data += part
    return data


class Rfb:
    def __init__(self, port):
        self.sock = socket.create_connection(("127.0.0.1", port), timeout=5)
        version = receive(self.sock, 12)
        self.sock.sendall(version)
        options = receive(self.sock, receive(self.sock, 1)[0])
        if 1 not in options:
            raise RuntimeError("Local no-auth RFB mode unavailable")
        self.sock.sendall(b"\x01")
        if struct.unpack(">I", receive(self.sock, 4))[0] != 0:
            raise RuntimeError("RFB handshake failed")
        self.sock.sendall(b"\x01")
        receive(self.sock, 20)
        receive(self.sock, struct.unpack(">I", receive(self.sock, 4))[0])

    def close(self):
        self.sock.close()

    def pointer(self, mask, x, y):
        self.sock.sendall(struct.pack(">BBHH", 5, mask, x, y))

    def key(self, down, keysym):
        self.sock.sendall(struct.pack(">BBHI", 4, int(down), 0, keysym))

    def click(self, x, y):
        self.pointer(0, x, y)
        time.sleep(0.12)
        self.pointer(1, x, y)
        time.sleep(0.12)
        self.pointer(0, x, y)
        time.sleep(0.3)

    def combo(self, modifier, key):
        self.key(True, modifier)
        time.sleep(0.12)
        self.key(True, key)
        time.sleep(0.08)
        self.key(False, key)
        time.sleep(0.12)
        self.key(False, modifier)
        time.sleep(0.4)

    def drag(self, start, end):
        self.pointer(0, *start)
        time.sleep(0.12)
        self.pointer(1, *start)
        time.sleep(0.15)
        for step in range(1, 9):
            x = round(start[0] + (end[0] - start[0]) * step / 8)
            y = round(start[1] + (end[1] - start[1]) * step / 8)
            self.pointer(1, x, y)
            time.sleep(0.07)
        self.pointer(0, *end)
        time.sleep(0.45)


def metadata(run):
    lines = (run / "session.txt").read_text().splitlines()
    return dict(line.split("=", 1) for line in lines if "=" in line)


def screen(run, display, label):
    target = run / "evidence/screens" / (label + ".png")
    subprocess.run(["import", "-display", display, "-window", "root", str(target)], check=True)
    image = Image.open(target).convert("RGB")
    center = image.getpixel((354, 664))
    return {"path": str(target), "snapOn": center[0] > 200,
            "snapPixel": list(center),
            "ready": image.getpixel((20, 120))[0] > 70}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(run):
    info = metadata(run)
    rfb = Rfb(int(info["rfb_port"]))
    source = run / "map/phase1-snap.dungeondraft_map"
    try:
        source_sha = sha256(source)
        deadline = time.monotonic() + 60
        while True:
            startup = screen(run, info["display"], "00-startup")
            if startup["ready"]:
                break
            if time.monotonic() >= deadline:
                raise TimeoutError("Dungeondraft did not reach the map toolbar")
            time.sleep(0.5)
        states = {"startup": startup}
        rfb.click(20, 80)
        time.sleep(0.8)
        rfb.click(56, 120)
        time.sleep(0.4)
        rfb.click(105, 146)
        tool = screen(run, info["display"], "01-building-rectangle")
        crop = Image.open(tool["path"]).crop((25, 45, 330, 108))
        title = run / "evidence/screens/01-building-title.png"
        crop.resize((1220, 252)).save(title)
        heading = subprocess.check_output(["tesseract", str(title), "stdout"],
                                          stderr=subprocess.DEVNULL, text=True)
        if "Building Tool" not in heading:
            raise AssertionError(f"Building Tool was not selected: {heading!r}")
        rfb.click(294, 16)
        time.sleep(0.8)
        states["savedBaseline"] = screen(run, info["display"], "01-saved-baseline")
        if not states["savedBaseline"]["snapOn"]:
            rfb.click(354, 664)
        states["beforeCtrlS"] = screen(run, info["display"], "02-before-ctrl-s")
        assert states["beforeCtrlS"]["snapOn"], "Snap could not be enabled"
        rfb.combo(CTRL, ord("s"))
        time.sleep(0.8)
        states["afterCtrlS"] = screen(run, info["display"], "03-after-ctrl-s")
        rfb.drag((464, 184), (528, 248))
        states["afterDrag"] = screen(run, info["display"], "04-after-drag")
        rfb.click(294, 16)
        time.sleep(0.8)
        saved = run / "evidence/maps/after-ctrl-s-drag.dungeondraft_map"
        shutil.copy2(source, saved)
        if not states["afterCtrlS"]["snapOn"]:
            rfb.click(354, 664)
        states["beforeToolbarSave"] = screen(run, info["display"], "05-before-toolbar-save")
        assert states["beforeToolbarSave"]["snapOn"]
        rfb.click(294, 16)
        time.sleep(0.8)
        states["afterToolbarSave"] = screen(run, info["display"], "06-after-toolbar-save")
        shape = json.loads(saved.read_text())["world"]["levels"]["0"]["shapes"]["polygons"]
        if not shape:
            raise AssertionError("The Building rectangle was not stored")
        result = {"version": "Dungeondraft 1.2.0.1 Opulent Kirin",
                  "sourceMapSha256": source_sha,
                  "states": states, "savedMap": str(saved),
                  "savedMapSha256": sha256(saved), "savedPolygons": shape}
        (run / "evidence/result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"run": str(run), "states": {k: v["snapOn"] for k, v in states.items()},
                          "savedPolygonCount": len(shape)}, ensure_ascii=False))
    finally:
        rfb.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    args = parser.parse_args()
    probe(args.run)
