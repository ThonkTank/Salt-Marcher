import { describe, expect, it } from "vitest";
import { riverDisplay, riverHit } from "./riverView";
import type { RiverView } from "./generated/RiverView";
function river(id: string, y = 0): RiverView {
  return {
    river: {
      id,
      name: id,
      nodes: [],
      path: [],
      settings: {
        tolerance: 0.1,
        roughness: 0.5,
        meander: 40,
        sourceFade: true,
        seed: 1,
      },
    },
    samples: [
      { point: [0, y], width: 2, water: 20, cut: 2 },
      { point: [100, y], width: 40, water: 10, cut: 8 },
    ],
  };
}
describe("river presentation", () => {
  it("replaces the complete affected network without leaving deleted channels", () => {
    const a = river("a"),
      b = river("b"),
      c = river("c");
    const moved = river("b", 50);
    expect(riverDisplay([a, b, c], { before: [a, b], after: [moved] })).toEqual(
      [c, moved],
    );
  });
  it("picks actual variable-width geometry and keeps screen-space tolerance in overview", () => {
    const a = river("a");
    expect(riverHit([a], [90, 15], 10)?.view.river.id).toBe("a");
    expect(riverHit([a], [0, 15], 10)).toBeNull();
    expect(riverHit([a], [0, 15], 0.1)?.view.river.id).toBe("a");
    expect(riverHit([a, river("b", 14)], [90, 15], 10)?.view.river.id).toBe(
      "b",
    );
  });
});
