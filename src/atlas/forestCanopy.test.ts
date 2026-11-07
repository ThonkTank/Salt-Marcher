import { expect, it } from "vitest";
import { forestCanopyAt } from "./forestCanopy";
import { landscapeSymbols } from "./landscapeView";

it("retains clearings and increases canopy coverage monotonically with density", () => {
  const totals = [0, 0, 0];
  for (let y = -2048; y <= 2048; y += 64)
    for (let x = -2048; x <= 2048; x += 64) {
      expect(forestCanopyAt(x, y, 0)[3]).toBe(0);
      const alpha = [0.25, 0.65, 1].map((d) => forestCanopyAt(x, y, d)[3]);
      expect(alpha[0]).toBeLessThanOrEqual(alpha[1]);
      expect(alpha[1]).toBeLessThanOrEqual(alpha[2]);
      expect(alpha[2]).toBe(255);
      alpha.forEach((a, i) => (totals[i] += a));
    }
  expect(totals[0]).toBeLessThan(totals[1] * 0.4);
  expect(totals[1]).toBeLessThan(totals[2]);
});

it("is continuous across negative world coordinates and tile boundaries", () => {
  for (const x of [-2048, -64, 0, 64, 2048]) {
    const left = forestCanopyAt(x - 0.001, 73, 0.65);
    const right = forestCanopyAt(x + 0.001, 73, 0.65);
    left.forEach((v, i) => expect(Math.abs(v - right[i])).toBeLessThan(0.1));
  }
});

it("uses no individual forest symbols at medium scales but retains near trees", () => {
  const forest = () => [255, 0, 0, 0] as const;
  expect(landscapeSymbols([-1000, -1000, 1000, 1000], 0.2, forest)).toEqual([]);
  expect(
    landscapeSymbols([-1000, -1000, 1000, 1000], 1, forest).length,
  ).toBeGreaterThan(0);
});
