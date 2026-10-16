"""Compare native and Host floor color contribution over the measured void.

The 18-case card uses three adjacent alpha values per style/tint. Their texture
variants need not match after reload, so this audit uses 40x40 interior means,
not a pixel-wise alpha estimate.
"""
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


def projected_fraction(half, full):
    return float(np.dot(half, full) / np.dot(full, full))


def audit(args):
    native = rgb(args.native)
    native_bg = rgb(args.native_background)
    host = rgb(args.host, True)
    host_bg = rgb(args.host_background, True)
    void = np.array([37.0, 37.0, 37.0])
    cases = []
    for base in range(0, 18, 3):
        style = "wood" if base < 9 else "diamond2"
        tint = ["white", "default", "red"][(base % 9) // 3]
        samples = {}
        for name, image, background, origin in (
            ("native", native, native_bg, (352, 288)),
            ("host", host, host_bg, (512, 234)),
        ):
            baseline = [mean_cell(background, base + offset, origin)
                        for offset in range(3)]
            observed = [mean_cell(image, base + offset, origin)
                        for offset in range(3)]
            half = observed[1] - void
            opaque = observed[2] - void
            samples[name] = {
                "zeroVsBackgroundMae": float(np.mean(np.abs(observed[0] - baseline[0]))),
                "zeroVsVoidMae": float(np.mean(np.abs(observed[0] - void))),
                "halfContributionRgb": [round(float(v), 3) for v in half],
                "opaqueContributionRgb": [round(float(v), 3) for v in opaque],
                "projectedHalfFraction": round(projected_fraction(half, opaque), 4),
                "opaqueMeanRgb": [round(float(v), 3) for v in observed[2]],
                "backgroundMeanRgb": [round(float(v), 3) for v in baseline[2]],
            }
        samples["style"] = style
        samples["tint"] = tint
        samples["halfFractionDifference"] = round(
            samples["host"]["projectedHalfFraction"] -
            samples["native"]["projectedHalfFraction"], 4)
        samples["opaqueMeanMae"] = round(float(np.mean(np.abs(
            np.array(samples["host"]["opaqueMeanRgb"]) -
            np.array(samples["native"]["opaqueMeanRgb"])))), 3)
        cases.append(samples)
    report = {"method": "40x40 interior mean, RGB after Host ICC to sRGB; "
                        "half/full contribution measured above native void #252525; "
                        "empty-map backgrounds are kept separate",
              "cases": cases}
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"zeroVsVoidMaxNative": max(x["native"]["zeroVsVoidMae"] for x in cases),
                      "zeroVsVoidMaxHost": max(x["host"]["zeroVsVoidMae"] for x in cases),
                      "maxHalfFractionDifference": max(abs(x["halfFractionDifference"]) for x in cases),
                      "maxOpaqueMeanMae": max(x["opaqueMeanMae"] for x in cases),
                      "fractions": [(x["style"], x["tint"],
                                     x["native"]["projectedHalfFraction"],
                                     x["host"]["projectedHalfFraction"])
                                    for x in cases]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--native", required=True)
    parser.add_argument("--native-background", required=True)
    parser.add_argument("--host", required=True)
    parser.add_argument("--host-background", required=True)
    parser.add_argument("--out", required=True)
    audit(parser.parse_args())
