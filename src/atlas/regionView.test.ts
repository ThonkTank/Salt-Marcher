import { describe, it, expect } from "vitest";
import { hitRegion, visibleRanks, regionNames } from "./regionView";
import type { Region } from "./generated/Region";
const catalog = {
  categories: [
    {
      id: "p",
      name: "Politisch",
      visible: true,
      fixedRank: null,
      markers: false,
    },
  ],
  ranks: [
    { id: "small", name: "Stadt", categoryId: "p" },
    { id: "large", name: "Land", categoryId: "p" },
  ],
};
const summaries = [
  {
    id: "a",
    rankId: "small",
    name: "A",
    area: 100,
    anchor: [0, 0] as [number, number],
  },
  {
    id: "b",
    rankId: "large",
    name: "B",
    area: 10000,
    anchor: [0, 0] as [number, number],
  },
];
describe("region presentation", () => {
  it("selects world-size appropriate ranks, keeps manual and editing overrides", () => {
    const prior = new Map<string, string>();
    expect(visibleRanks(catalog, summaries, 4, prior)).toEqual(["large"]);
    expect(visibleRanks(catalog, summaries, 40, prior)).toEqual(["small"]);
    expect(
      visibleRanks(
        {
          ...catalog,
          categories: [{ ...catalog.categories[0], fixedRank: "large" }],
        },
        summaries,
        40,
        prior,
      ),
    ).toEqual(["large"]);
    expect(
      visibleRanks(
        {
          ...catalog,
          categories: [{ ...catalog.categories[0], visible: false }],
        },
        summaries,
        40,
        prior,
      ),
    ).toEqual([]);
    expect(visibleRanks(catalog, summaries, 4, prior, "small")).toEqual([
      "small",
    ]);
  });
  it("does not select holes but selects disjoint islands", () => {
    const r: Region = {
      id: "r",
      name: "R",
      rankId: "small",
      style: { color: "#123456", opacity: 0.15, width: 2, dash: "solid" },
      label: { anchor: null, minScale: null, maxScale: null },
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
    expect(hitRegion([r], [1, 1])?.id).toBe("r");
    expect(hitRegion([r], [3, 3])).toBeUndefined();
    expect(hitRegion([r], [25, 5])?.id).toBe("r");
    expect(hitRegion([r], [15, 5])).toBeUndefined();
  });
});

it("region labels honor zoom overrides, stable anchors and occupied screen space", () => {
  const context = {
    measureText: (s: string) => ({ width: s.length * 8 }),
    font: "",
  } as CanvasRenderingContext2D;
  const r: Region = {
    id: "a",
    name: "Stadt",
    rankId: "small",
    polygons: [],
    style: { color: "#123456", opacity: 0.15, width: 2, dash: "solid" },
    label: { anchor: null, minScale: null, maxScale: null },
  };
  const camera = { x: 300, y: 200, scale: 10 };
  expect(
    regionNames(context, [r], summaries, camera, 800, 600, [])[0],
  ).toMatchObject({ x: 300, y: 200 });
  expect(
    regionNames(context, [r], summaries, { ...camera, scale: 1 }, 800, 600, []),
  ).toEqual([]);
  expect(
    regionNames(context, [r], summaries, camera, 800, 600, [
      [280, 180, 320, 220],
    ]),
  ).toEqual([]);
  const override = {
    ...r,
    label: { anchor: [10, 10] as [number, number], minScale: 0.1, maxScale: 2 },
  };
  expect(
    regionNames(
      context,
      [override],
      summaries,
      { ...camera, scale: 1 },
      800,
      600,
      [],
    )[0],
  ).toMatchObject({ x: 310, y: 210 });
  expect(
    regionNames(context, [override], summaries, camera, 800, 600, []),
  ).toEqual([]);
});

it("uses ordinary region categories for settlement symbols and all their ranks", () => {
  const places = {
    ...catalog,
    categories: [{ ...catalog.categories[0], markers: true }],
  };
  expect(visibleRanks(places, summaries, 1, new Map())).toEqual([
    "small",
    "large",
  ]);
  const context = {
    measureText: (s: string) => ({ width: s.length * 7 }),
    font: "",
  } as CanvasRenderingContext2D;
  const region: Region = {
    id: "a",
    name: "Dorf",
    rankId: "small",
    polygons: [],
    style: { color: "#123456", opacity: 0.15, width: 2, dash: "solid" },
    label: { anchor: null, minScale: null, maxScale: null },
  };
  const labels = regionNames(
    context,
    [region],
    summaries,
    { x: 300, y: 200, scale: 1 },
    800,
    600,
    [],
    500,
    ["small"],
  );
  expect(labels[0].marker).toEqual([300, 200]);
  expect(
    regionNames(
      context,
      [region],
      summaries,
      { x: 300, y: 200, scale: 1 },
      800,
      600,
      [],
    ),
  ).toEqual([]);
});
