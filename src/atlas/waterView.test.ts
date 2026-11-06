import { expect, it } from "vitest";
import { waterAt } from "./waterView";
import type { WaterBody } from "./generated/WaterBody";

it("water hits exclude holes, include separate islands and preserve input priority", () => {
  const water: WaterBody = {
    id: "lake",
    level: 12,
    polygons: [
      {
        outer: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        holes: [
          [
            [2, 2],
            [4, 2],
            [4, 4],
            [2, 4],
          ],
        ],
      },
      {
        outer: [
          [20, 0],
          [30, 0],
          [30, 10],
          [20, 10],
        ],
        holes: [],
      },
    ],
  };
  expect(waterAt([water], [1, 1])).toBe(12);
  expect(waterAt([water], [3, 3])).toBeNull();
  expect(waterAt([water], [25, 5])).toBe(12);
  expect(waterAt([water], [15, 5])).toBeNull();
  expect(waterAt([water], [0, 0])).toBe(12);
  expect(waterAt([water], [10, 5])).toBeNull();
  expect(waterAt([water, { ...water, id: "other", level: 20 }], [1, 1])).toBe(
    12,
  );
});
