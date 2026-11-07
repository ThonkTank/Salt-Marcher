import { describe, expect, it, vi } from "vitest";
import { landscapeSymbols, landscapeDetails } from "./landscapeView";

describe("landscape scale projection", () => {
  it("does no individual asset work in world views or beyond the candidate budget", () => {
    const sample = vi.fn(() => [255, 0, 0, 0] as const);
    expect(landscapeSymbols([-1e8, -1e8, 1e8, 1e8], 0.00001, sample)).toEqual(
      [],
    );
    expect(landscapeSymbols([-1e8, -1e8, 1e8, 1e8], 1, sample)).toEqual([]);
    expect(sample).not.toHaveBeenCalled();
    expect(landscapeDetails(0.1)[0]?.near).toBe(false);
    expect(landscapeDetails(1)[0]?.near).toBe(true);
  });
  it("retains world positions and variants across pan, zoom and density", () => {
    const full = () => [255, 0, 0, 0] as const;
    const sparse = landscapeSymbols([-500, -500, 500, 500], 1, () => [
      90, 0, 0, 0,
    ]);
    const dense = landscapeSymbols([-500, -500, 500, 500], 2, full);
    expect(sparse.length).toBeGreaterThan(50);
    for (const symbol of sparse) expect(dense).toContainEqual(symbol);
    const panned = landscapeSymbols([-250, -250, 750, 750], 2, full);
    expect(
      panned.filter((s) => s.asset.point.every((v) => v <= 480 && v >= -230)),
    ).toEqual(
      dense.filter((s) => s.asset.point.every((v) => v >= -230 && v <= 480)),
    );
  });
  it("draws nothing in clearings and keeps biome recipes separate", () => {
    expect(
      landscapeSymbols([-200, -200, 200, 200], 1, () => [0, 0, 0, 0]),
    ).toEqual([]);
    const rocks = landscapeSymbols([-200, -200, 200, 200], 1, () => [
      0, 0, 0, 255,
    ]);
    expect(rocks.length).toBeGreaterThan(0);
    expect(rocks.every((s) => s.biome === "rocks")).toBe(true);
  });
});

it("keeps visible crowns whose center lies just outside the viewport", () => {
  const all = landscapeSymbols([-100, -100, 100, 100], 1, () => [255, 0, 0, 0]);
  const tree = all.find((s) => s.asset.point[0] > 0 && s.asset.point[1] > 0)!;
  const [x, y] = tree.asset.point;
  const clipped = landscapeSymbols(
    [x + tree.asset.size / 2, y - 2, x + tree.asset.size * 2, y + 2],
    1,
    () => [255, 0, 0, 0],
  );
  expect(clipped).toContainEqual(tree);
});

it("crossfades overview and near symbols without an empty band", () => {
  for (const scale of [0.27, 0.32, 0.35, 0.38, 0.42, 0.5]) {
    const details = landscapeDetails(scale);
    expect(details.reduce((sum, detail) => sum + detail.alpha, 0)).toBeCloseTo(
      1,
    );
    const symbols = landscapeSymbols([-1000, -1000, 1000, 1000], scale, () => [
      0, 255, 0, 0,
    ]);
    for (const detail of details)
      expect(symbols.some((symbol) => symbol.near === detail.near)).toBe(true);
  }
});

it("keeps both transition representations within the shared budget at desktop size", () => {
  for (const scale of [0.351, 0.38, 0.42, 0.49]) {
    const sample = vi.fn(() => [0, 255, 0, 0] as const);
    const symbols = landscapeSymbols(
      [0, 0, 1440 / scale, 960 / scale],
      scale,
      sample,
    );
    expect(sample.mock.calls.length).toBeLessThanOrEqual(16384);
    expect(symbols.some((s) => s.near)).toBe(true);
    expect(symbols.some((s) => !s.near)).toBe(true);
  }
});
