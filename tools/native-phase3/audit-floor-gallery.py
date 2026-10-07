"""Compare the native and Host 18x12 gallery cards at 50% / 32 px per field.

Pass the native saved map and screenshot after fresh reopen, the Host gallery24
manifest and screenshot after fresh reopen, and an output JSON path.
"""
import argparse
from io import BytesIO
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageCms


def cell_ids(level):
    return [int(value) for value in re.findall(r"-?\d+", level["tiles"]["cells"])]


def tile_pixels(image, origin, index):
    left = origin[0] + index % 6 * 96
    top = origin[1] + index // 6 * 96
    return np.concatenate([
        np.asarray(image.crop((left + dx + 3, top + dy + 3,
                               left + dx + 29, top + dy + 29)), dtype=np.int16)
        .reshape(-1, 3)
        for dy in (0, 32) for dx in (0, 32)
    ])


def audit(native_map, native_image, host_manifest, host_image):
    level = json.loads(native_map.read_text())["world"]["levels"]["0"]
    ids = cell_ids(level)
    host = json.loads(host_manifest.read_text())
    assert len(level["shapes"]["polygons"]) == 24
    assert len(level["walls"]) == 0
    assert len(ids) == 18 * 12 and len(host) == 24
    original = Image.open(native_image).convert("RGB")
    host_png = Image.open(host_image)
    assert "chromaticity" in Image.open(native_image).info
    assert "icc_profile" in host_png.info
    editor = ImageCms.profileToProfile(
        host_png, ImageCms.ImageCmsProfile(BytesIO(host_png.info["icc_profile"])),
        ImageCms.createProfile("sRGB"), outputMode="RGB")
    rows = []
    for index, item in enumerate(host):
        x, y = index % 6 * 3, index // 6 * 3
        cells = [ids[(y + dy) * 18 + x + dx]
                 for dy in (0, 1) for dx in (0, 1)]
        assert len(set(cells)) == 1 and cells[0] >= 0
        tile_id = cells[0]
        path = level["tiles"]["lookup"][str(tile_id)]
        colors = [level["tiles"]["colors"][(y + dy) * 18 + x + dx]
                  for dy in (0, 1) for dx in (0, 1)]
        assert len(set(colors)) == 1
        assert path == item["image"], (index, path, item["image"])
        assert colors[0].lower() == "ff" + item["storedColor"].lower()
        difference = np.abs(tile_pixels(original, (352, 288), index) -
                            tile_pixels(editor, (512, 234), index))
        rows.append({"index": index, "texturePath": path,
                     "nativeColor": colors[0], "hostColor": item["storedColor"],
                     "nativeTileId": tile_id,
                     "imageMae": round(float(difference.mean()), 3),
                     "imageP95": round(float(np.percentile(difference, 95)), 3),
                     "channelMae": [round(float(value), 3)
                                    for value in difference.mean(axis=0)]})
    assert len({row["texturePath"] for row in rows}) == 24
    return {"reference": "Dungeondraft 1.2.0.1 Opulent Kirin",
            "nativeMap": str(native_map), "nativeScreenshot": str(native_image),
            "hostManifest": str(host_manifest), "hostScreenshot": str(host_image),
            "colorManagement": "Original sRGB chromaticity; Host embedded Skia ICC converted to sRGB",
            "shapeCount": 24, "wallCount": 0,
            "uniqueTexturePaths": 24, "exactDefaultColors": 24,
            "meanImageMae": round(sum(row["imageMae"] for row in rows) / 24, 3),
            "maximumImageMae": max(row["imageMae"] for row in rows),
            "styles": rows}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("native_map", type=Path)
    parser.add_argument("native_image", type=Path)
    parser.add_argument("host_manifest", type=Path)
    parser.add_argument("host_image", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = audit(args.native_map, args.native_image,
                   args.host_manifest, args.host_image)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: result[key] for key in
                      ("shapeCount", "uniqueTexturePaths", "exactDefaultColors",
                       "meanImageMae", "maximumImageMae")}))
