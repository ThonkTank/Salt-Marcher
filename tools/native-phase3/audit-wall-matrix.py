"""Compare saved Building wall cards at the measured 32 px/field origins."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


ORIGINS = {"native": (352, 288), "host": (512, 234)}
REGIONS = {
    "topWallCore": (slice(0, 4), slice(8, 56)),
    "leftWallCore": (slice(8, 56), slice(0, 4)),
    "topStrip": (slice(0, 10), slice(8, 56)),
    "leftStrip": (slice(8, 56), slice(0, 10)),
    "upperCorner": (slice(0, 12), slice(0, 12)),
    "floorInterior": (slice(12, 52), slice(12, 52)),
    "wholeCell": (slice(0, 64), slice(0, 64)),
}


def position(index, layout):
    if layout == "interior":
        return 1 + index % 5 * 3, 1 + index // 5 * 3
    return index % 6 * 3, index // 6 * 3


def cell(image, origin, index, layout):
    col, row = position(index, layout)
    x = origin[0] + col * 32
    y = origin[1] + row * 32
    return image[y:y + 64, x:x + 64]


def audit(args):
    level = json.loads(args.native_map.read_text())["world"]["levels"]["0"]
    walls = level["walls"][:9] if args.kind == "tint" else level["walls"]
    host_data = json.loads(args.host_manifest.read_text())
    rows = host_data["reference"] if args.kind == "tint" else host_data
    assert len(walls) == len(rows) == (9 if args.kind == "tint" else 10)
    assert args.layout == "edge" or args.kind == "tint"
    native = np.asarray(Image.open(args.native_image).convert("RGB"), dtype=np.int16)
    host_source = Image.open(args.host_image)
    assert not host_source.info.get("icc_profile"), "Use a forced-sRGB Host image"
    host = np.asarray(host_source.convert("RGB"), dtype=np.int16)
    results = []
    for index, (wall, row) in enumerate(zip(walls, rows)):
        assert wall["color"].lower() == (
            row["argb"].lower() if args.kind == "tint" else
            "ff" + format(row["hostWall"], "06x"))
        if args.kind == "gallery":
            assert wall["texture"] == row["image"]
        else:
            assert (row["x"], row["y"]) == position(index, args.layout)
        a = cell(native, ORIGINS["native"], index, args.layout)
        b = cell(host, ORIGINS["host"], index, args.layout)
        scores = {}
        for name, (ys, xs) in REGIONS.items():
            diff = np.abs(a[ys, xs] - b[ys, xs])
            scores[name] = {
                "maeRgb": round(float(diff.mean()), 3),
                "pixelsWithinTwoRgb": round(float(
                    np.mean(np.max(diff, axis=2) <= 2)), 4),
            }
        results.append({
            "index": index,
            "texture": wall["texture"],
            "argb": wall["color"],
            "regions": scores,
            "upperInnerDarkPixelFraction": {
                "native": round(float(np.mean(a[3, 8:56].mean(axis=1) < 40)), 4),
                "host": round(float(np.mean(b[3, 8:56].mean(axis=1) < 40)), 4),
            },
        })
    output = {
        "kind": args.kind,
        "layout": args.layout,
        "nativeMap": str(args.native_map),
        "nativeImage": str(args.native_image),
        "hostManifest": str(args.host_manifest),
        "hostImage": str(args.host_image),
        "originsPx": ORIGINS,
        "fieldPixels": 32,
        "gapBackgroundNotPaired": True,
        "rows": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"kind": args.kind, "count": len(results),
        "topStripMaeRgb": [item["regions"]["topStrip"]["maeRgb"]
                          for item in results]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=("gallery", "tint"), required=True)
    parser.add_argument("--layout", choices=("edge", "interior"), default="edge")
    parser.add_argument("--native-map", type=Path, required=True)
    parser.add_argument("--native-image", type=Path, required=True)
    parser.add_argument("--host-manifest", type=Path, required=True)
    parser.add_argument("--host-image", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    audit(parser.parse_args())
