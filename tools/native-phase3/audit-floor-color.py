"""Compare floor tint/alpha cards after fresh Original and Host reopen."""
import argparse
import json
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageCms


def rgb(path, host=False):
    source = Image.open(path)
    if host and source.info.get("icc_profile"):
        source = ImageCms.profileToProfile(source.convert("RGB"),
            ImageCms.ImageCmsProfile(BytesIO(source.info["icc_profile"])),
            ImageCms.createProfile("sRGB"), outputMode="RGB")
    return np.asarray(source.convert("RGB"), dtype=np.float64)


def mean_cell(image, index, origin):
    x = origin[0] + index % 6 * 96
    y = origin[1] + index // 6 * 96
    return image[y + 12:y + 52, x + 12:x + 52].mean(axis=(0, 1))


def fraction(half, full):
    return float(np.dot(half, full) / np.dot(full, full))


def audit(args):
    manifest = json.loads(Path(args.manifest).read_text())
    assert len(manifest) in (9, 18)
    native = rgb(args.native)
    native_bg = rgb(args.native_background)
    host = rgb(args.host, True)
    host_bg = rgb(args.host_background, True)
    void = np.array([37.0, 37.0, 37.0])
    cases = []
    for base in range(0, len(manifest), 3):
        first = manifest[base]
        assert [manifest[base + i]["alpha"] for i in range(3)] == [
            "zero", "half", "opaque"]
        assert len({manifest[base + i]["style"] for i in range(3)}) == 1
        samples = {}
        for name, image, background, origin in (
            ("native", native, native_bg, (352, 288)),
            ("host", host, host_bg, (512, 234)),
        ):
            observed = [mean_cell(image, base + i, origin) for i in range(3)]
            baseline = [mean_cell(background, base + i, origin) for i in range(3)]
            samples[name] = {
                "zeroMeanRgb": [round(float(v), 3) for v in observed[0]],
                "zeroVsVoidMae": round(float(np.abs(observed[0] - void).mean()), 3),
                "zeroVsBackgroundMae": round(float(np.abs(observed[0] - baseline[0]).mean()), 3),
                "halfFraction": round(fraction(observed[1] - void,
                                               observed[2] - void), 4),
                "opaqueMeanRgb": [round(float(v), 3) for v in observed[2]],
            }
        samples["style"] = first["style"]
        samples["tint"] = first["tint"]
        samples["argb"] = [manifest[base + i]["storedArgb"] for i in range(3)]
        samples["halfFractionDifference"] = round(
            samples["host"]["halfFraction"] - samples["native"]["halfFraction"], 4)
        samples["opaqueMeanMae"] = round(float(np.abs(
            np.array(samples["host"]["opaqueMeanRgb"]) -
            np.array(samples["native"]["opaqueMeanRgb"])).mean()), 3)
        cases.append(samples)
    result = {"method": "40x40 interior means at corresponding card coordinates; "
                        "Host forced sRGB; contribution above Original #252525 underlay; "
                        "Original and Host reopened in fresh processes",
              "nativeScreenshot": args.native, "hostScreenshot": args.host,
              "manifest": args.manifest, "cases": cases,
              "maxZeroVsVoidNative": max(row["native"]["zeroVsVoidMae"] for row in cases),
              "maxZeroVsVoidHost": max(row["host"]["zeroVsVoidMae"] for row in cases),
              "maxHalfFractionDifference": max(abs(row["halfFractionDifference"]) for row in cases),
              "maxOpaqueMeanMae": max(row["opaqueMeanMae"] for row in cases)}
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: result[key] for key in (
        "maxZeroVsVoidNative", "maxZeroVsVoidHost",
        "maxHalfFractionDifference", "maxOpaqueMeanMae")}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--native", required=True)
    parser.add_argument("--native-background", required=True)
    parser.add_argument("--host", required=True)
    parser.add_argument("--host-background", required=True)
    parser.add_argument("--out", required=True)
    audit(parser.parse_args())
