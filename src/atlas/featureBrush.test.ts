import { describe, expect, it } from "vitest";
import {
  featurePreset,
  featurePresets,
  featureResolution,
  metres,
  resizeFeatureRadius,
  terrainScreenRadius,
} from "./featureBrush";
const brush = {
  mode: "land" as const,
  radius: 40,
  amount: 1,
  strength: 0.25,
  target: 10,
};
describe("physical terrain features", () => {
  it("couples preset width and relief while keeping a bounded author grid", () => {
    for (const mode of ["mountains", "hills", "canyon"] as const) {
      featurePresets[mode].forEach((preset, index) => {
        const feature = featurePreset(brush, mode, index);
        expect(feature.radius * 2 * metres).toBeCloseTo(preset.width);
        expect(feature.featureHeight * metres).toBeCloseTo(preset.height);
        const intervals =
          feature.radius / (5 * 2 ** featureResolution(feature.radius));
        expect(intervals).toBeGreaterThanOrEqual(32);
        expect(intervals).toBeLessThan(64);
        expect(terrainScreenRadius(feature, 0.002) / 0.002).toBe(
          feature.radius,
        );
        expect(terrainScreenRadius(feature, 2) / 2).toBe(feature.radius);
        expect(terrainScreenRadius(feature, 0.002, true)).toBe(40);
      });
    }
  });
  it("sizes physical features independently of the pixel brush limits", () => {
    expect(resizeFeatureRadius(10000, 2)).toBe(20000);
    expect(resizeFeatureRadius(1, 0.1)).toBe(10 / (2 * metres));
    expect(resizeFeatureRadius(1e9, 2)).toBe(200000 / (2 * metres));
    expect(terrainScreenRadius(brush, 0.002)).toBe(40);
  });
});
