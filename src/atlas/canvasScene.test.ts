import { expect, it } from "vitest";
import { prepareCanvasScene } from "./canvasScene";
import type { Presentation } from "./presentationLoader";
import type { Preview } from "./model";

it("combines same-level preview terrain without discarding untouched tiles", () => {
  const left = { x: 0, y: 0, heights: [10], foundationTops: [["house", 12]] };
  const right = { x: 1, y: 0, heights: [20], foundationTops: [] };
  const changed = { ...left, heights: [30], foundationTops: [["house", 32]] };
  const presentation = {
    scene: { objects: [] },
    terrain: { level: 0, tiles: [left, right] },
  } as unknown as Presentation;
  const preview = {
    valid: true,
    terrain: { surface: { level: 0, tiles: [changed] } },
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
    { kind: "parcel", id: "hidden" },
    { kind: "area", id: "old", order: 1 },
  ];
  const presentation = { scene: { objects } } as unknown as Presentation;
  const frame = prepareCanvasScene(presentation, null, "hidden", {
    boundaries: [],
    grids: [],
  });
  expect(
    frame.layers.find((l) => l.kind === "area")?.objects.map((o) => o.id),
  ).toEqual(["old", "new"]);
  expect(frame.layers.find((l) => l.kind === "parcel")?.objects).toEqual([]);
  expect(frame.selectedObject).toBeUndefined();
  expect(objects.map((o) => o.id)).toEqual(["new", "hidden", "old"]);
});
