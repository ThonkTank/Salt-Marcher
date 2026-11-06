import { expect, it } from "vitest";
import { prepareCanvasScene } from "./canvasScene";
import type { Presentation } from "./presentationLoader";
import type { Preview } from "./model";

it("combines same-level preview terrain without discarding untouched tiles", () => {
  const status = { sessionId: "s", revision: 1 };
  const left = { x: 0, y: 0, heights: [10], foundationTops: [["house", 12]] };
  const right = { x: 1, y: 0, heights: [20], foundationTops: [] };
  const changed = { ...left, heights: [30], foundationTops: [["house", 32]] };
  const presentation = {
    scene: { objects: [] },
    terrain: { status, level: 0, tiles: [left, right] },
  } as unknown as Presentation;
  const preview = {
    valid: true,
    terrain: { surface: { status, level: 0, tiles: [changed] } },
  } as unknown as Preview;
  const frame = prepareCanvasScene(presentation, preview, "", {
    boundaries: [],
    grids: [],
  });
  expect(frame.terrain?.tiles).toEqual([right, changed]);
  expect(frame.foundationTops.get("house")).toBe(32);
  expect(frame.terrainPreview).toBeUndefined();
  expect(presentation.terrain?.tiles).toEqual([left, right]);
  const coarse = {
    valid: true,
    terrain: { surface: { level: 1, tiles: [changed] } },
  } as unknown as Preview;
  expect(
    prepareCanvasScene(presentation, coarse, "", { boundaries: [], grids: [] })
      .terrain?.tiles,
  ).toEqual([changed]);
});

it("orders material layers and omits hidden parcel selection without mutating the scene", () => {
  const objects = [
    { kind: "area", id: "new", order: 2 },
    { kind: "parcel", id: "first" },
    { kind: "scenery", id: "scenery" },
    { kind: "parcel", id: "hidden" },
    { kind: "road", id: "road", width: 2, path: [] },
    { kind: "area", id: "old", order: 1 },
    { kind: "parcel", id: "second" },
    { kind: "house", id: "house", contours: [] },
  ];
  const before = structuredClone(objects);
  const visibility = {
    boundaries: ["second", "first"],
    grids: ["hidden", "first"],
  };
  const visibilityBefore = structuredClone(visibility);
  const presentation = { scene: { objects } } as unknown as Presentation;
  const frame = prepareCanvasScene(presentation, null, "hidden", visibility);
  expect(
    frame.layers.map((layer) => [layer.kind, layer.objects.map((o) => o.id)]),
  ).toEqual([
    ["area", ["old", "new"]],
    ["scenery", ["scenery"]],
    ["parcel", ["first", "second"]],
    ["road", ["road"]],
    ["house", ["house"]],
  ]);
  expect(frame.selectedObject).toBeUndefined();
  expect(
    prepareCanvasScene(presentation, null, "second", visibility).selectedObject,
  ).toBe(objects[6]);
  expect(frame.grids).toEqual([objects[1], objects[3]]);
  expect(objects).toEqual(before);
  expect(visibility).toEqual(visibilityBefore);
});

it("merges ground preview tiles only for the current level and revision", () => {
  const status = { sessionId: "s", revision: 1 };
  const left = { x: 0, y: 0, pixels: "old" },
    right = { x: 1, y: 0, pixels: "untouched" },
    changed = { ...left, pixels: "painted" };
  const presentation = {
    scene: { objects: [] },
    ground: { status, level: 0, tiles: [left, right] },
  } as unknown as Presentation;
  const preview = {
    valid: true,
    ground: { status, level: 0, tiles: [changed] },
  } as unknown as Preview;
  const visibility = { boundaries: [], grids: [] };
  expect(
    prepareCanvasScene(presentation, preview, "", visibility).ground?.tiles,
  ).toEqual([changed, right]);
  const stale = {
    valid: true,
    ground: { status: { ...status, revision: 0 }, level: 0, tiles: [changed] },
  } as unknown as Preview;
  expect(
    prepareCanvasScene(presentation, stale, "", visibility).ground?.tiles,
  ).toEqual([left, right]);
  const coarse = {
    valid: true,
    ground: { status, level: 1, tiles: [changed] },
  } as unknown as Preview;
  expect(
    prepareCanvasScene(presentation, coarse, "", visibility).ground?.tiles,
  ).toEqual([left, right]);
});

it("does not mix terrain previews or ground across revisions", () => {
  const status = { sessionId: "s", revision: 1 };
  const newer = { ...status, revision: 2 };
  const presentation = {
    scene: { objects: [] },
    terrain: { status, level: 0, tiles: [{ x: 0, y: 0 }] },
    ground: { status, level: 0, tiles: [{ x: 0, y: 0 }] },
  } as unknown as Presentation;
  const preview = {
    valid: true,
    terrain: { surface: { status: newer, level: 0, tiles: [{ x: 1, y: 0 }] } },
  } as unknown as Preview;
  const frame = prepareCanvasScene(presentation, preview, "", {
    boundaries: [],
    grids: [],
  });
  expect(frame.terrain?.tiles).toEqual([{ x: 1, y: 0 }]);
  expect(frame.ground).toBeUndefined();
});

it("keeps complete deduplicated city features separate from selection and detail labels", () => {
  const feature = (id: string, name: string) =>
    Object.freeze({
      id,
      name,
      kind: "road",
      paths: [],
      color: "",
      width: 20,
      rank: 1000,
      important: false,
    });
  const first = feature("selected", "overview"),
    owner = feature("owner", "owner"),
    last = feature("selected", "last");
  const tiles = Object.freeze([
    Object.freeze({ features: Object.freeze([first, owner]) }),
    Object.freeze({ features: Object.freeze([last]) }),
  ]);
  const presentation = {
    overview: { level: 0, tiles },
    scene: {
      objects: [
        {
          kind: "road",
          id: "selected",
          name: "exact",
          width: 20,
          path: [
            [0, 0],
            [100, 0],
          ],
        },
      ],
    },
    detail: { buildingId: "owner" },
  } as unknown as Presentation;
  const frame = prepareCanvasScene(presentation, null, "selected", {
    boundaries: [],
    grids: [],
  });
  expect(frame.cityFeatures).toEqual([last, owner]);
  expect(frame.features.map((f) => [f.id, f.name])).toEqual([
    ["selected", "exact"],
  ]);
  expect(tiles[0].features).toEqual([first, owner]);
});
