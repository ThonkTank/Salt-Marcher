import { expect, it } from "vitest";
import { landscapeMargin, landscapeRequest } from "./landscapeRequest";

it("requests enough coverage for offscreen crowns without growing the tile budget", () => {
  for (const scale of [25.6, 1, 0.35, 0.42, 0.5, 0.1, 0.000002]) {
    const bounds: [number, number, number, number] = [
      -15,
      -12,
      1440 / scale - 15,
      960 / scale - 12,
    ];
    const request = landscapeRequest(bounds, 0, scale);
    expect(request.tiles.length).toBeLessThanOrEqual(64);
    const width = 64 * 2 ** request.level;
    const margin = landscapeMargin(scale);
    expect(
      Math.min(...request.tiles.map(([x]) => x * width)),
    ).toBeLessThanOrEqual(bounds[0] - margin);
    expect(
      Math.min(...request.tiles.map(([, y]) => y * width)),
    ).toBeLessThanOrEqual(bounds[1] - margin);
    // Far requests are clipped by the global world extent.
    if (scale >= 0.03) {
      expect(
        Math.max(...request.tiles.map(([x]) => (x + 1) * width)),
      ).toBeGreaterThanOrEqual(bounds[2] + margin);
      expect(
        Math.max(...request.tiles.map(([, y]) => (y + 1) * width)),
      ).toBeGreaterThanOrEqual(bounds[3] + margin);
    }
  }
});
